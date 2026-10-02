export function ConsentFields() {
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg bg-slate-50 p-3">
      <legend className="px-1 text-sm font-semibold">Permiso para marketing (obligatorio)</legend>
      <label className="flex flex-col gap-1 text-sm font-medium">
        ¿Cómo te dio el permiso?
        <select name="method" required defaultValue="" className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base">
          <option value="" disabled>Elige una opción</option>
          <option value="formulario_web">Formulario en la web</option>
          <option value="mensaje_whatsapp">Me lo pidió por WhatsApp</option>
          <option value="presencial">En persona (tienda, evento)</option>
          <option value="importacion">Base que ya tenía con permiso</option>
          <option value="otro">Otro</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        ¿Dónde o cómo? (queda en el registro)
        <input name="sourceDetail" required minLength={3} className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" placeholder='Ej. "Formulario de la web, casilla marcada"' />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Fecha del permiso
        <input name="grantedAt" type="date" className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Evidencia (opcional: enlace, captura, número de formulario)
        <input name="evidence" className="rounded-lg border border-slate-300 bg-white px-3 py-3 text-base" />
      </label>
    </fieldset>
  )
}
