import { useState } from 'react';
import { MapPin as MapPinned, Phone } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Institucion } from '../types';

/** URL utilizable como <img src>: http(s), ruta del sitio, data:image o blob. */
function isValidImageUrl(url: string | null | undefined): url is string {
  const value = url?.trim();
  if (!value) return false;
  return /^(https?:\/\/|\/(?!\/)|data:image\/|blob:)/i.test(value);
}

/**
 * Tarjeta del catálogo de instituciones. Si la institución no tiene logotipo o foto
 * válidos (o la imagen falla al cargar), no se renderiza el contenedor gráfico:
 * queda solo la tarjeta tipográfica con sus datos y acciones.
 */
export default function InstitutionCard({
  institution,
  imageUrl,
}: {
  institution: Institucion;
  imageUrl?: string | null;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = isValidImageUrl(imageUrl) && !imageFailed;

  return (
    <div className={`uca-card-v2 ${showImage ? '' : 'uca-card-v2--no-image'}`}>
      {showImage ? (
        <div className="uca-card-header">
          <img src={imageUrl} alt={institution.nombre} loading="lazy" onError={() => setImageFailed(true)} />
          <div className="uca-verified-badge">Aliada</div>
        </div>
      ) : null}

      <div className="uca-card-body">
        <div className="uca-card-tags">
          {institution.tipo?.trim() ? <span className="uca-category-tag">{institution.tipo.toUpperCase()}</span> : null}
          {showImage ? null : <span className="uca-verified-badge uca-verified-badge--inline">Aliada</span>}
        </div>
        <h2 className="uca-card-title">{institution.nombre}</h2>

        {institution.ubicacion?.trim() ? (
          <div className="uca-card-location">
            <MapPinned size={14} />
            <span>{institution.ubicacion}</span>
          </div>
        ) : null}

        {institution.telefono?.trim() ? (
          <div className="uca-card-location">
            <Phone size={14} />
            <span>
              {institution.telefono}
              {institution.contactoNombre?.trim() ? ` · ${institution.contactoNombre}` : ''}
            </span>
          </div>
        ) : null}

        <div className="uca-card-stats-container">
          {institution.estadisticas?.slice(0, 2).map(([value, label]) => (
            <div key={label} className="uca-stat-line">
              <span className="stat-label">{label}</span>
              <span className="stat-value">{value}</span>
            </div>
          ))}
        </div>

        <Link to={`/instituciones/${institution.id}`} className="uca-card-button">
          Ver institución
        </Link>
      </div>
    </div>
  );
}
