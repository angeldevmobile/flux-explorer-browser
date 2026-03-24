import Modal from "./Modal";

interface TermsOfServiceProps {
  open: boolean;
  onClose: () => void;
}

export default function TermsOfService({ open, onClose }: TermsOfServiceProps) {
  return (
    <Modal open={open} onClose={onClose} title="Términos de Servicio">
      <p className="text-slate-400 text-xs mb-6">
        Última actualización: 1 de marzo de 2026
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        1. Aceptación de los Términos
      </h3>
      <p>
        Al acceder y utilizar Flux Browser (&quot;el Servicio&quot;), aceptas estar
        vinculado por estos Términos de Servicio. Si no estás de acuerdo con
        alguna parte de estos términos, no podrás acceder al Servicio.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        2. Descripción del Servicio
      </h3>
      <p>
        Flux Browser es un navegador web moderno que ofrece funcionalidades de
        navegación, sincronización de datos, marcadores, historial y
        personalización de la experiencia de usuario.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        3. Registro de Cuenta
      </h3>
      <p>
        Para acceder a ciertas funciones del Servicio, debes crear una cuenta.
        Te comprometes a:
      </p>
      <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
        <li>Proporcionar información veraz, precisa y actualizada.</li>
        <li>Mantener la seguridad de tu contraseña y cuenta.</li>
        <li>
          Notificar inmediatamente cualquier uso no autorizado de tu cuenta.
        </li>
        <li>
          No crear cuentas con identidades falsas o suplantando a otra persona.
        </li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        4. Uso Aceptable
      </h3>
      <p>Te comprometes a no utilizar el Servicio para:</p>
      <ul className="list-disc list-inside space-y-1 mt-2 text-slate-400">
        <li>Violar leyes o regulaciones aplicables.</li>
        <li>Transmitir contenido malicioso, virus o código dañino.</li>
        <li>Interferir con el funcionamiento del Servicio.</li>
        <li>Acceder a sistemas o datos sin autorización.</li>
        <li>
          Realizar actividades de scraping, minería de datos o recopilación
          automatizada sin consentimiento.
        </li>
      </ul>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        5. Propiedad Intelectual
      </h3>
      <p>
        El Servicio y su contenido original, características y funcionalidad son
        propiedad de Flux Browser y están protegidos por leyes de propiedad
        intelectual internacionales. No se permite la reproducción, distribución
        o creación de obras derivadas sin autorización expresa.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        6. Contenido del Usuario
      </h3>
      <p>
        Al utilizar el Servicio, puedes generar datos como marcadores,
        historial, configuraciones y preferencias. Tú conservas la titularidad
        de tus datos personales. Nos otorgas una licencia limitada para procesar
        estos datos únicamente con el fin de proporcionarte el Servicio.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        7. Disponibilidad del Servicio
      </h3>
      <p>
        Nos esforzamos por mantener el Servicio disponible de manera continua,
        pero no garantizamos un funcionamiento ininterrumpido. Podemos realizar
        mantenimientos programados o de emergencia que afecten temporalmente la
        disponibilidad.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        8. Limitación de Responsabilidad
      </h3>
      <p>
        En la máxima medida permitida por la ley, Flux Browser no será
        responsable por daños indirectos, incidentales, especiales,
        consecuentes o punitivos, incluyendo pérdida de datos, beneficios o
        ingresos, ya sea por garantía, contrato, agravio u otra teoría legal.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        9. Terminación
      </h3>
      <p>
        Podemos suspender o cancelar tu acceso al Servicio inmediatamente, sin
        previo aviso, si incumples estos Términos. Tras la terminación, tu
        derecho a usar el Servicio cesará inmediatamente. Puedes solicitar la
        eliminación de tu cuenta y datos en cualquier momento.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        10. Modificaciones
      </h3>
      <p>
        Nos reservamos el derecho de modificar estos Términos en cualquier
        momento. Te notificaremos de cambios significativos mediante un aviso en
        el Servicio. El uso continuado del Servicio después de dichos cambios
        constituye tu aceptación de los nuevos Términos.
      </p>

      <h3 className="text-base font-semibold text-white mt-6 mb-2">
        11. Contacto
      </h3>
      <p>
        Si tienes preguntas sobre estos Términos, puedes contactarnos en:{" "}
        <span className="text-cyan-400">soporte@orionbrowser.com</span>
      </p>
    </Modal>
  );
}