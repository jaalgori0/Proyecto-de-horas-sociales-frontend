import {
  PROJECT_CLASIFICACION_LABELS,
  PROJECT_CLASIFICACIONES,
  type ProjectClasificacion,
} from '../services/api';

/**
 * Casillas para las 4 clasificaciones de proyecto (no excluyentes: se pueden
 * marcar varias o todas). Si incluye "Servicio social interno", las horas del
 * proyecto se registran como internas; en otro caso, como externas.
 */
export default function ProjectClassificationsField({
  value,
  onChange,
}: {
  value: ProjectClasificacion[];
  onChange: (next: ProjectClasificacion[]) => void;
}) {
  function toggle(code: ProjectClasificacion) {
    const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
    // Orden fijo, igual que el backend.
    onChange(PROJECT_CLASIFICACIONES.filter((c) => next.includes(c)));
  }

  return (
    <fieldset className="classification-field">
      <legend>
        Clasificación del proyecto <span className="classification-required">*</span>
      </legend>
      <p className="classification-hint">Puede seleccionar varias.</p>
      <div className="classification-options">
        {PROJECT_CLASIFICACIONES.map((code) => (
          <label key={code} className={`classification-option ${value.includes(code) ? 'checked' : ''}`}>
            <input type="checkbox" checked={value.includes(code)} onChange={() => toggle(code)} />
            <span>{PROJECT_CLASIFICACION_LABELS[code]}</span>
          </label>
        ))}
      </div>
      <p className="classification-hint">
        {value.length === 0
          ? 'Seleccione al menos una clasificación.'
          : value.includes('SS_INTERNO')
            ? 'Las horas de este proyecto se registrarán como internas.'
            : 'Las horas de este proyecto se registrarán como externas.'}
      </p>
    </fieldset>
  );
}
