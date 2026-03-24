import { Router, Request, Response, raw } from "express";

const router = Router();

// Leer el body como Buffer sin límite de tamaño ni parseo JSON
// para poder reenviarlo tal cual al sitio externo
router.use(raw({ type: "*/*", limit: "100mb" }));

const BLOCKED_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
  "x-content-type-options",
  "cross-origin-opener-policy",
  "cross-origin-embedder-policy",
  "cross-origin-resource-policy",
  // Transferencia — los calcula Express sobre el cuerpo ya descomprimido
  "content-encoding",
  "content-length",
  "transfer-encoding",
];

/**
 * Convierte una URL absoluta en una ruta de proxy path-based.
 */
function toProxyPath(url: string): string {
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("#") ||
    url.startsWith("javascript:") ||
    url.startsWith("/api/proxy/")
  ) {
    return url;
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return url;
    return `/api/proxy/${parsed.host}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/**
 * Convierte cualquier URL en el HTML (absoluta o relativa) a ruta de proxy.
 */
function resolveToProxy(url: string, origin: string): string {
  url = url.trim();
  if (
    !url ||
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.startsWith("#") ||
    url.startsWith("javascript:") ||
    url.startsWith("/api/proxy/")
  ) {
    return url;
  }

  try {
    if (/^https?:\/\//i.test(url) || url.startsWith("//")) {
      const abs = url.startsWith("//") ? "https:" + url : url;
      return toProxyPath(abs);
    }
    if (url.startsWith("/")) {
      // Root-relative -> resolver contra el origen del sitio
      const parsed = new URL(origin);
      return `/api/proxy/${parsed.host}${url}`;
    }
    // Relativa — el navegador la resolverá correctamente si el HTML está
    return url;
  } catch {
    return url;
  }
}

/**
 * Genera el script de interceptación con el host real del sitio proxeado,
 * para que las rutas root-relativas (ej: /_/BardChatUi/...) resuelvan
 * correctamente contra el host original y no contra localhost.
 */
function buildRuntimeIntercept(siteHost: string): string {
  return `<script>
(function(){
  var P='/api/proxy/';
  var H='${siteHost}';
  function tp(url){
    if(!url||typeof url!=='string') return url;
    if(url.startsWith('data:')||url.startsWith('blob:')||
       url.startsWith('#')||url.startsWith('javascript:')||
       url.startsWith('/api/proxy/')||url.startsWith('chrome-extension:')) return url;
    try{
      if(/^https?:\\/\\//i.test(url)||url.startsWith('//')){
        var u=new URL(url.startsWith('//')?'https:'+url:url);
        var p=u.pathname;
        if(p.indexOf('/api/proxy/')===0) return '/'+p.slice(1)+u.search+u.hash;
        return P+u.host+p+u.search+u.hash;
      }
      if(url.startsWith('/')){
        return P+H+url;
      }
    }catch(e){}
    return url;
  }
  var _f=window.fetch.bind(window);
  window.fetch=function(input,init){
    if(typeof input==='string') input=tp(input);
    else if(input&&input.url) input=new Request(tp(input.url),input);
    return _f(input,init);
  };
  var _o=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,url){
    var args=Array.prototype.slice.call(arguments);
    args[1]=tp(url);
    return _o.apply(this,args);
  };
})();
</script>`;
}

/**
 * Reescribe atributos src, href, action y srcset en HTML.
 */
function rewriteHtml(html: string, origin: string, siteHost: string): string {
  html = html.replace(
    /(\b(?:src|href|action)\s*=\s*)(["'])(.*?)\2/gi,
    (_, attr, quote, url) =>
      `${attr}${quote}${resolveToProxy(url, origin)}${quote}`
  );

  html = html.replace(
    /(\bsrcset\s*=\s*)(["'])(.*?)\2/gi,
    (_, attr, quote, srcset) => {
      const rewritten = srcset.replace(
        /([^\s,]+)(\s+[\d.]+[wx])?/g,
        (_m: string, u: string, descriptor: string) =>
          resolveToProxy(u.trim(), origin) + (descriptor ?? "")
      );
      return `${attr}${quote}${rewritten}${quote}`;
    }
  );

  // Eliminar <base> del sitio original
  html = html.replace(/<base[^>]*>/gi, "");

  // Inyectar interceptor de fetch/XHR con el host real del sitio
  const intercept = buildRuntimeIntercept(siteHost);
  if (/<head[\s>]/i.test(html)) {
    html = html.replace(/(<head[^>]*>)/i, `$1${intercept}`);
  } else {
    html = intercept + html;
  }

  return html;
}

/**
 * Reescribe solo sentencias de import estático/dinámico en JS.
 * NO reescribe paths genéricos entre comillas para evitar falsos positivos
 * cuando el JS concatena strings base + path (causa doble proxying).
 * Las llamadas fetch/XHR son interceptadas en runtime por RUNTIME_INTERCEPT.
 */
function rewriteJs(text: string, targetUrl: URL): string {
  const host = targetUrl.host;

  text = text.replace(
    /\bimport\s*\(\s*(["'`])(\/[^"'`\s]+)\1\s*\)/g,
    (_, quote, path) => `import(${quote}/api/proxy/${host}${path}${quote})`
  );

  text = text.replace(
    /(\bfrom\s+)(["'])(\/[^"'`\s]+)\2/g,
    (_, from, quote, path) => `${from}${quote}/api/proxy/${host}${path}${quote}`
  );

  return text;
}

function rewriteCss(text: string, origin: string): string {
  return text.replace(
    /url\((["']?)(https?:\/\/[^"')]+|\/[^"')]+)\1\)/gi,
    (_m, q, u) => `url(${q}${resolveToProxy(u, origin)}${q})`
  );
}

// Handler principal (reutilizado por ambas rutas)
async function handleProxy(target: string, req: Request, res: Response): Promise<void> {
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    res.status(400).json({ error: "URL inválida" });
    return;
  }

  if (!["http:", "https:"].includes(targetUrl.protocol)) {
    res.status(400).json({ error: "Protocolo no permitido" });
    return;
  }

  const origin = `${targetUrl.protocol}//${targetUrl.host}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  const method = req.method ?? "GET";
  // req.body es un Buffer gracias al middleware raw() del router
  const rawBody: Buffer | undefined =
    ["POST", "PUT", "PATCH"].includes(method) && Buffer.isBuffer(req.body)
      ? req.body
      : undefined;

  try {
    const upstream = await fetch(target, {
      method,
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8",
        "Accept-Encoding": "identity",
        ...(rawBody && req.headers["content-type"]
          ? { "Content-Type": req.headers["content-type"] as string }
          : {}),
        // Reenviar cookies del cliente para peticiones autenticadas
        ...(req.headers["cookie"]
          ? { "Cookie": req.headers["cookie"] as string }
          : {}),
      },
      ...(rawBody ? { body: new Uint8Array(rawBody) } : {}),
      redirect: "follow",
    });

    clearTimeout(timeout);

    upstream.headers.forEach((value, key) => {
      if (!BLOCKED_HEADERS.includes(key.toLowerCase())) {
        res.setHeader(key, value);
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.removeHeader("x-frame-options");
    res.removeHeader("content-security-policy");

    const contentType = upstream.headers.get("content-type") ?? "text/html";
    res.status(upstream.status);

    if (contentType.includes("text/html")) {
      let html = await upstream.text();
      html = rewriteHtml(html, origin, targetUrl.host);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } else if (contentType.includes("javascript") || contentType.includes("ecmascript")) {
      let text = await upstream.text();
      text = rewriteJs(text, targetUrl);
      res.setHeader("Content-Type", contentType);
      res.send(text);
    } else if (contentType.includes("text/css")) {
      let text = await upstream.text();
      text = rewriteCss(text, origin);
      res.setHeader("Content-Type", contentType);
      res.send(text);
    } else {
      const buffer = await upstream.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (err: unknown) {
    clearTimeout(timeout);
    const message = err instanceof Error ? err.message : "Error desconocido";
    const isTimeout =
      message.includes("abort") ||
      message.includes("timeout") ||
      message.includes("AbortError");
    res.status(502).json({
      error: isTimeout
        ? "Tiempo de espera agotado"
        : "No se pudo cargar la página",
      detail: message,
    });
  }
}

// Ruta 1 (legacy): /api/proxy?url=https://...
router.all("/", async (req: Request, res: Response) => {
  const target = req.query.url as string;
  if (!target) {
    res.status(400).json({ error: "Falta el parámetro url" });
    return;
  }
  await handleProxy(target, req, res);
});

// Usa RegExp para compatibilidad con path-to-regexp v8+
router.all(/^\/(.+)$/, async (req: Request, res: Response) => {
  const fullPath = (req.params as Record<string, string>)[0];
  if (!fullPath) {
    res.status(400).json({ error: "Falta la URL" });
    return;
  }
  const qs = Object.keys(req.query).length
    ? "?" + new URLSearchParams(req.query as Record<string, string>).toString()
    : "";
  const target = `https://${fullPath}${qs}`;
  await handleProxy(target, req, res);
});

export default router;
