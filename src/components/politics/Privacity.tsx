import Modal from "./Modal";

interface PrivacyPolicyProps {
  open: boolean;
  onClose: () => void;
}

export default function PrivacyPolicy({ open, onClose }: PrivacyPolicyProps) {
  return (
    <Modal open={open} onClose={onClose} title="Política de Privacidad">
      <p className="text-slate-400 text-xs mb-6">
        Última actualización: 1 de marzo de 2026
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        1. Información que Recopilamos
      </h3>
      <p>Recopilamos los siguientes tipos de información:</p>

      <h4 className="text-sm font-semibold text-slate-200 mt-4 mb-1.5">
        1.1 Información proporcionada por ti
      </h4>
      <ul className="list-disc list-inside space-y-1 text-slate-400">
        <li>
          <strong className="text-slate-300">Datos de registro:</strong> nombre
          completo, nombre de usuario, dirección de correo electrónico y
          contraseña (almacenada de forma cifrada).
        </li>
        <li>
          <strong className="text-slate-300">Datos de perfil:</strong>{" "}
          configuraciones y preferencias que personalices.
        </li>
      </ul>

      <h4 className="text-sm font-semibold text-slate-200 mt-4 mb-1.5">
        1.2 Información recopilada automáticamente
      </h4>
      <ul className="list-disc list-inside space-y-1 text-slate-400">
        <li>
          <strong className="text-slate-300">Datos de uso:</strong> historial de
          navegación, marcadores y pestañas (almacenados localmente o
          sincronizados con tu consentimiento).
        </li>
        <li>
          <strong className="text-slate-300">Datos técnicos:</strong> tipo de
          dispositivo, sistema operativo, versión del navegador y dirección IP
          (para seguridad y diagnóstico).
        </li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        2. Cómo Usamos tu Información
      </h3>
      <p>Utilizamos la información recopilada para:</p>
      <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
        <li>Proporcionar y mantener el Servicio.</li>
        <li>Sincronizar tus datos entre dispositivos (si lo activas).</li>
        <li>Mejorar y personalizar tu experiencia de navegación.</li>
        <li>Proteger la seguridad de tu cuenta y del Servicio.</li>
        <li>Comunicarte actualizaciones importantes del Servicio.</li>
        <li>Detectar y prevenir actividades fraudulentas.</li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        3. Almacenamiento y Seguridad
      </h3>
      <p>Implementamos medidas de seguridad para proteger tu información:</p>
      <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
        <li>
          <strong className="text-slate-300">Cifrado:</strong> todas las
          contraseñas se almacenan con hash bcrypt. Las comunicaciones se
          realizan mediante conexión SSL/TLS.
        </li>
        <li>
          <strong className="text-slate-300">Almacenamiento local:</strong> tu
          historial y marcadores pueden almacenarse localmente en tu dispositivo
          sin necesidad de sincronización.
        </li>
        <li>
          <strong className="text-slate-300">Tokens seguros:</strong> la
          autenticación utiliza tokens JWT con expiración automática.
        </li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        4. Compartir Información
      </h3>
      <p>
        <strong className="text-slate-200">
          No vendemos tu información personal.
        </strong>{" "}
        Solo compartimos datos en las siguientes circunstancias:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
        <li>Con tu consentimiento explícito.</li>
        <li>Para cumplir con obligaciones legales.</li>
        <li>
          Para proteger los derechos, seguridad o propiedad de Flux Browser o
          sus usuarios.
        </li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        5. Tus Derechos
      </h3>
      <p>Tienes derecho a:</p>
      <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
        <li>
          <strong className="text-slate-300">Acceder</strong> a tus datos
          personales almacenados.
        </li>
        <li>
          <strong className="text-slate-300">Rectificar</strong> información
          incorrecta o desactualizada.
        </li>
        <li>
          <strong className="text-slate-300">Eliminar</strong> tu cuenta y todos
          los datos asociados.
        </li>
        <li>
          <strong className="text-slate-300">Exportar</strong> tus datos en un
          formato estándar.
        </li>
        <li>
          <strong className="text-slate-300">Revocar</strong> el consentimiento
          de sincronización en cualquier momento.
        </li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        6. Cookies y Tecnologías Similares
      </h3>
      <p>
        Utilizamos cookies esenciales para el funcionamiento del Servicio
        (autenticación y preferencias). No utilizamos cookies de rastreo de
        terceros ni publicidad dirigida.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        7. Retención de Datos
      </h3>
      <p>
        Conservamos tus datos mientras mantengas una cuenta activa. Si solicitas
        la eliminación de tu cuenta, eliminaremos tus datos personales en un
        plazo máximo de 30 días, excepto cuando la ley exija su conservación.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        8. Menores de Edad
      </h3>
      <p>
        El Servicio no está dirigido a menores de 13 años. No recopilamos
        intencionalmente información de menores. Si descubrimos que hemos
        recopilado datos de un menor, los eliminaremos inmediatamente.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        9. Cambios a esta Política
      </h3>
      <p>
        Podemos actualizar esta Política de Privacidad periódicamente. Te
        notificaremos de cambios significativos mediante un aviso en el
        Servicio. Te recomendamos revisarla regularmente.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        10. Contacto
      </h3>
      <p>
        Para consultas sobre privacidad, contacta a nuestro equipo en:{" "}
        <span className="text-cyan-400">privacidad@orionbrowser.com</span>
      </p>

      <div className="mt-6 p-4 rounded-xl bg-cyan-500/[0.06] border border-cyan-500/20">
        <div className="flex items-center gap-2 mb-2">
          <svg
            className="w-4 h-4 text-cyan-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
            />
          </svg>
          <span className="text-sm font-semibold text-cyan-400">
            Nuestro compromiso
          </span>
        </div>
        <p className="text-xs text-slate-400">
          En Flux Browser, la privacidad es una prioridad. Diseñamos nuestro
          servicio con el principio de minimización de datos: solo recopilamos
          lo estrictamente necesario para ofrecerte una gran experiencia de
          navegación.
        </p>
      </div>
    </Modal>
  );
}