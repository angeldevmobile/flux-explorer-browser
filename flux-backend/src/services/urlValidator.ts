export class UrlValidator {
  /**
   * Valida si una URL es válida
   */
  static isValid(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === "http:" || urlObj.protocol === "https:";
    } catch {
      return false;
    }
  }

  /**
   * Normaliza una URL (agrega https:// si no tiene protocolo)
   */
  static normalize(url: string): string {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      return `https://${url}`;
    }
    return url;
  }

  /**
   * Sanitiza una URL para evitar inyecciones
   */
  static sanitize(url: string): string {
    return url.trim().replace(/[<>'"]/g, "");
  }
}