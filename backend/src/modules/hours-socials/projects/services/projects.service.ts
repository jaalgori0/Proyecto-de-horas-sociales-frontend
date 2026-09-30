import { col, fn, QueryTypes, Transaction, where } from 'sequelize';
import sequelize from '../../../../core/config/database.js';
import Institution, { type InstitutionAttributes } from '../../../../models/institution.model.js';
import Project from '../../../../models/project.model.js';
import ProjectEnrollment from '../../../../models/enrollment.model.js';
import Student from '../../../../models/student.model.js';
import MapMarker from '../../../../models/marker.model.js';
import { HttpError } from '../../../../utils/httpError.js';
import type { ProjectStatus } from '../../../../types/domain.js';
import { pool } from '../../../../core/config/pool.js';

const allowedStatuses: ProjectStatus[] = ['Activo', 'En planificación', 'En convocatoria', 'Cerrado'];

type ProjectListStatus = 'Activo' | 'En progreso' | 'Cerrado' | 'En planificación' | 'En convocatoria';

type StudentDraft = {
  nombre?: unknown;
  carnet?: unknown;
  carrera?: unknown;
  genero?: unknown;
  avatar?: unknown;
  email?: unknown;
};

type DetailObjective = {
  title: string;
  description: string;
};

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function deriveSigla(nombre: string) {
  const letters = nombre
    .split(/\s+/)
    .map((word) => word.trim()[0])
    .filter(Boolean)
    .join('')
    .toUpperCase();

  return (letters || 'INST').slice(0, 8);
}

async function resolveInstitution(body: Record<string, unknown>, transaction: Transaction) {
  const institutionIdValue = Number(body.institutionId);
  const institutionName     = normalizeText(body.institutionName ?? body.institution);
  const institutionLocation = normalizeText(body.institutionLocation ?? body.ubicacion);
  const institutionDescription = normalizeText(body.institutionDescription ?? body.descripcion);
  const institutionImage    = normalizeText(body.institutionImage ?? body.institutionImageUrl);
  const institutionType     = normalizeText(body.institutionType ?? body.tipo);

  // ── Caso 1: se envía institutionId → actualizar ESA institución (nunca crear otra)
  if (Number.isInteger(institutionIdValue) && institutionIdValue > 0) {
    const institution = await Institution.findByPk(institutionIdValue, { transaction });
    if (institution) {
      const updatePayload: Partial<InstitutionAttributes> = {};
      if (institutionName)        updatePayload.nombre      = institutionName;
      if (institutionName)        updatePayload.sigla       = deriveSigla(institutionName);
      if (institutionLocation)    updatePayload.ubicacion   = institutionLocation;
      if (institutionDescription) updatePayload.descripcion = institutionDescription;
      if (institutionImage)       updatePayload.image_url   = institutionImage;
      if (institutionType)        updatePayload.tipo        = institutionType;
      if (Object.keys(updatePayload).length > 0) {
        await institution.update(updatePayload, { transaction });
      }
      return institution;
    }
  }

  // ── Caso 2: sin institutionId → buscar por nombre exacto (ignoring case) o crear
  //if (!institutionName) {
 //   throw new HttpError(400, 'Missing required fields: institutionName');
 // }

  const existingInstitution = await Institution.findOne({
    where: where(fn('LOWER', col('nombre')), institutionName.toLowerCase()),
    transaction,
  });

  if (existingInstitution) {
    await existingInstitution.update(
      {
        ubicacion:   institutionLocation   || existingInstitution.ubicacion,
        descripcion: institutionDescription || existingInstitution.descripcion,
        image_url:   institutionImage      || existingInstitution.image_url,
        tipo:        institutionType       || existingInstitution.tipo,
      },
      { transaction }
    );
    return existingInstitution;
  }

  const createdInstitution = await Institution.create({
    nombre:      institutionName,
    sigla:       deriveSigla(institutionName),
    ubicacion:   institutionLocation    || 'Sin ubicación registrada',
    descripcion: institutionDescription || `Institución registrada para el proyecto ${normalizeText(body.titulo) || institutionName}`,
    tipo:        institutionType  || null,
    image_url:   institutionImage || null,
  }, { transaction });

  return createdInstitution;
}

function collectStudents(body: Record<string, unknown>) {
  const rawStudents = Array.isArray(body.students)
    ? body.students
    : Array.isArray(body.equipo)
      ? body.equipo.map((name) => ({ nombre: name, carnet: '' }))
      : [];

  return rawStudents
    .map((student) => ({
      nombre: normalizeText((student as StudentDraft).nombre),
      carnet: normalizeText((student as StudentDraft).carnet),
      carrera: normalizeText((student as StudentDraft).carrera),
      genero:  normalizeText((student as StudentDraft).genero) || null,
      avatar: normalizeText((student as StudentDraft).avatar) || null,
      email: normalizeText((student as StudentDraft).email) || null,
    }))
    .filter((student) => Boolean(student.nombre && student.carnet));
}

function getProjectListStatus(estado: ProjectStatus): ProjectListStatus {
  if (estado === 'Cerrado') return 'Cerrado';
  if (estado === 'Activo') return 'Activo';
  return 'En progreso';
}

function mapVisibleStatusToProjectStatus(status: unknown): ProjectStatus | null {
  if (status === 'Activo') return 'Activo';
  if (status === 'En progreso') return 'En convocatoria';
  if (status === 'Cerrado') return 'Cerrado';
  if (status === 'En planificación') return 'En planificación';
  if (status === 'En convocatoria') return 'En convocatoria';
  return null;
}

function formatCapacity(personas: number, cupos: number | null) {
  if (cupos === null || Number.isNaN(cupos)) {
    return {
      cuposOcupados: personas,
      cuposTotales: null,
      cuposTexto: `${personas} ocupados`,
    };
  }

  return {
    cuposOcupados: personas,
    cuposTotales: cupos,
    cuposTexto: `${personas} de ${cupos}`,
  };
}

function buildKeyObjectives(description: string): DetailObjective[] {
  const normalized = description.trim().replace(/\s+/g, ' ');
  if (!normalized) return [];

  const sentences = normalized
    .split(/[.\n;]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const sourcePhrases = sentences.length > 0 ? sentences : [normalized];

  return sourcePhrases.slice(0, 4).map((sentence) => {
    const words = sentence.split(/\s+/).filter(Boolean);
    const title = words.slice(0, Math.min(6, words.length)).join(' ');

    return {
      title: title.length > 0 ? title : sentence.slice(0, 50),
      description: sentence,
    };
  });
}

function normalizeProjectStatus(status: ProjectStatus): 'Activo' | 'En progreso' | 'Cerrado' {
  if (status === 'Cerrado') return 'Cerrado';
  if (status === 'Activo') return 'Activo';
  return 'En progreso';
}

function countActiveEnrollmentsFromPlain(plain: any) {
  const enrollments = Array.isArray(plain.enrollments) ? plain.enrollments : [];
  if (enrollments.length === 0) {
    return null;
  }

  return enrollments.filter((enrollment: any) => enrollment?.activo !== false).length;
}

function sumMarkerValues(markers: Array<{ hombres?: number; mujeres?: number }>) {
  return markers.reduce<{ hombres: number; mujeres: number }>(
    (accumulator, marker) => ({
      hombres: accumulator.hombres + Number(marker.hombres ?? 0),
      mujeres: accumulator.mujeres + Number(marker.mujeres ?? 0),
    }),
    { hombres: 0, mujeres: 0 }
  );
}

function toProjectDetailDTO(
  project: any,
  enrollments: Array<{ nombre?: string; carnet?: string; carrera?: string; genero?: 'Masculino' | 'Femenino' | null; avatar?: string | null; email?: string | null }>
) {
  const plain = typeof project.get === 'function' ? project.get({ plain: true }) : project;
  const base = toProjectDTO(plain);
  // Contar género desde los enrollments reales, no desde map_markers estáticos
  const genderTotals = enrollments.reduce(
    (acc, e) => {
      if (e.genero === 'Masculino') acc.hombres += 1;
      else if (e.genero === 'Femenino') acc.mujeres += 1;
      return acc;
    },
    { hombres: 0, mujeres: 0 }
  );
  const activeEnrollments = enrollments.length;
  const cuposTotales = base.cuposTotales;
  const cuposOcupados = activeEnrollments;
  const cuposTexto = cuposTotales != null ? `${cuposOcupados} de ${cuposTotales}` : `${cuposOcupados} ocupados`;

  return {
    ...base,
    nombre: base.titulo,
    imagen: base.image,
    status: normalizeProjectStatus(plain.estado),
    estado: plain.estado,
    institution: base.institutionName,
    descripcion: base.descripcion,
    equipo: enrollments.map((student) => student.nombre ?? '').filter(Boolean),
    estudiantes: enrollments,
    estudiantesAsignados: activeEnrollments,
    cuposTexto,
    cuposOcupados,
    cuposTotales,
    carreras: base.carreras,
    hombres: genderTotals.hombres,
    mujeres: genderTotals.mujeres,
  };
}

function toProjectDTO(project: any) {
  const plain = typeof project.get === 'function' ? project.get({ plain: true }) : project;
  const activeEnrollments = countActiveEnrollmentsFromPlain(plain);
  const personas = activeEnrollments ?? plain.personas ?? 0;
  const cupos = plain.cupos ?? null;
  const capacity = formatCapacity(personas, cupos);
  return {
    id: plain.id,
    institutionId: plain.institution_id, // se cambio
    institutionName: plain.institution?.nombre ?? '', // se cambio
    institutionSigla: plain.institution?.sigla ?? '', // se cambio
    institutionTipo: plain.institution?.tipo ?? '', // se cambio
    institutionDescripcion: plain.institution?.descripcion ?? '', // se cambio
    institutionImageUrl: plain.institution?.image_url ?? null, // se cambio
    titulo: plain.titulo,
    ubicacion: plain.ubicacion,
    estado: plain.estado,
    estadoLista: getProjectListStatus(plain.estado),
    status: getProjectListStatus(plain.estado),
    facultad: plain.facultad ?? 'General',
    carreras: plain.carreras ?? [],
    descripcion: plain.descripcion,
    resumen: plain.resumen ?? null,
    fechaInicio: plain.fecha_inicio ?? null,
    fechaCierre: plain.fecha_cierre ?? null,
    cupos,
    cuposOcupados: capacity.cuposOcupados,
    cuposTotales: capacity.cuposTotales,
    cuposTexto: capacity.cuposTexto,
    image: plain.image_url ?? null,
    equipo: plain.team_members ?? [],
    personas,
    institution: plain.institution?.nombre ?? plain.institutionName ?? '',
  };
}

function toProjectListDTO(project: any) {
  const payload = toProjectDTO(project);
  const { image, ...listPayload } = payload;
  return listPayload;
}

function toProjectMapDTO(project: any) {
  const plain = typeof project.get === 'function' ? project.get({ plain: true }) : project;
  const markers = Array.isArray(plain.markers) ? plain.markers : [];
  const totals = sumMarkerValues(markers);

  return {
    id: plain.id,
    institution: plain.institution?.nombre ?? '',
    status: normalizeProjectStatus(plain.estado),
    nombre: plain.titulo,
    ubicacion: plain.ubicacion,
    descripcion: plain.descripcion,
    hombres: totals.hombres,
    mujeres: totals.mujeres,
  };
}

class ProjectsService {
  public listProjects = async (filters: { search?: string; status?: string; institutionId?: string; location?: string; faculty?: string } = {}) => {
    const where: any = {};

    if (filters.institutionId) where.institution_id = filters.institutionId;

    const search = filters.search?.trim();

    const projects = await Project.findAll({
      where,
      include: [
        {
          model: Institution,
          as: 'institution',
          attributes: ['id', 'nombre', 'sigla'],
          required: true,
        },
        {
          model: ProjectEnrollment,
          as: 'enrollments',
          required: false,
          attributes: ['id', 'activo'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    const mapped = projects.map(toProjectListDTO);

    const loweredSearch = search?.toLowerCase();
    const loweredLocation = filters.location?.trim().toLowerCase();
    const normalizedStatus = filters.status?.trim().toLowerCase();
    const normalizedFaculty = filters.faculty?.trim().toLowerCase();

    return mapped.filter((project) => {
      const matchesSearch = !loweredSearch || project.titulo.toLowerCase().includes(loweredSearch);
      const matchesLocation = !loweredLocation || project.ubicacion.toLowerCase().includes(loweredLocation);
      const matchesStatus = !normalizedStatus || project.status.toLowerCase() === normalizedStatus;
      const matchesFaculty =
        !normalizedFaculty ||
        normalizedFaculty === 'todas las facultades' ||
        project.facultad.toLowerCase() === normalizedFaculty;

      return matchesSearch && matchesLocation && matchesStatus && matchesFaculty;
    });
  };

  public listProjectsForMap = async () => {
    // Obtener todos los proyectos con su institución (sin filtrar por markers)
    const projects = await Project.findAll({
      include: [
        {
          model: Institution,
          as: 'institution',
          attributes: ['id', 'nombre', 'sigla'],
          required: true,
        },
        {
          model: ProjectEnrollment,
          as: 'enrollments',
          required: false,
          attributes: ['id', 'activo'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    // Contar género real desde project_enrollments + students en una sola consulta
    const genderSql = `
      SELECT
        e.project_id,
        COALESCE(COUNT(*) FILTER (WHERE s.genero = 'Masculino'), 0) AS hombres,
        COALESCE(COUNT(*) FILTER (WHERE s.genero = 'Femenino'),  0) AS mujeres
      FROM project_enrollments e
      JOIN students s ON s.id = e.student_id
      WHERE e.activo = true
      GROUP BY e.project_id;
    `;
    const genderResult = await pool.query(genderSql);
    const genderByProject = new Map<number, { hombres: number; mujeres: number }>();
    for (const row of genderResult.rows) {
      genderByProject.set(Number(row.project_id), {
        hombres: Number(row.hombres),
        mujeres: Number(row.mujeres),
      });
    }

    return projects.map((project) => {
      const plain = typeof project.get === 'function' ? project.get({ plain: true }) : project;
      const gender = genderByProject.get(Number(plain.id)) ?? { hombres: 0, mujeres: 0 };
      return {
        id: plain.id,
        institution: plain.institution?.nombre ?? '',
        status: normalizeProjectStatus(plain.estado),
        nombre: plain.titulo,
        ubicacion: plain.ubicacion,
        descripcion: plain.descripcion,
        hombres: gender.hombres,
        mujeres: gender.mujeres,
      };
    });
  };

  public listDirectoryProjects = async (filters: {
    query?: string;
    faculty?: string;
    status?: ProjectStatus | 'Todos';
    location?: string;
    sortBy?: 'recentes' | 'titulo' | 'ubicacion';
  } = {}) => {
    const projects = await this.listProjects({ search: filters.query, status: filters.status === 'Todos' ? undefined : filters.status });
    const filtered = projects.filter((project) => {
      const matchesFaculty = !filters.faculty || filters.faculty === 'Todas las facultades' || project.carreras.length === 0
        ? true
        : project.carreras.some((career: string) => career.toLowerCase().includes(filters.faculty!.toLowerCase().split(' ')[0]));
      const matchesLocation = !filters.location || filters.location === 'Todas' || project.ubicacion.toLowerCase().includes(filters.location.toLowerCase());
      return matchesFaculty && matchesLocation;
    });

    return [...filtered].sort((a, b) => {
      if (filters.sortBy === 'titulo') return a.titulo.localeCompare(b.titulo);
      if (filters.sortBy === 'ubicacion') return a.ubicacion.localeCompare(b.ubicacion);
      return b.id.localeCompare(a.id);
    });
  };

  public getProjectById = async (id: string | number) => {
    const project = await Project.findByPk(id, {
      include: [
        { model: Institution, as: 'institution', attributes: ['id', 'nombre', 'sigla', 'tipo', 'descripcion', 'image_url'], required: true }, //se cambió
        { model: MapMarker, as: 'markers', required: false, attributes: ['id', 'hombres', 'mujeres'] },
      ],
    });

    if (!project) return null;

    const enrollments = await this.listEnrollmentsByProjectId(id);
    return toProjectDetailDTO(project, enrollments);
  };

  public getProjectDetail = async (id: string) => {
    const project = await Project.findByPk(id, {
      include: [
        { model: Institution, as: 'institution', attributes: ['id', 'nombre', 'sigla', 'tipo', 'descripcion', 'image_url'], required: true }, //se cambió	
        { model: MapMarker, as: 'markers', required: false, attributes: ['id', 'hombres', 'mujeres'] },
      ],
    });

    if (!project) return null;

    const enrollments = await this.listEnrollmentsByProjectId(id);
    const detail = toProjectDetailDTO(project, enrollments);

    return {
      ...detail,
      resumen: detail.resumen ?? detail.descripcion,
      fechas: [detail.fechaInicio, detail.fechaCierre].filter(Boolean).join(' - ') || null,
      desplegados: `${detail.estudiantesAsignados ?? detail.personas} estudiantes asignados`,
    };
  };

  public listEnrollmentsByProjectId = async (projectId: string | number) => {
    const enrollments = await ProjectEnrollment.findAll({
      where: { project_id: projectId },
      include: [{ model: Student, as: 'student', required: true }],
      order: [['created_at', 'DESC']],
    });

    return enrollments.map((enrollment) => ({
      id: enrollment.id,
      project_id: enrollment.project_id,
      student_id: enrollment.student_id,
      cargo: enrollment.cargo,
      activo: enrollment.activo,
      created_at: enrollment.created_at,
      nombre: (enrollment.get('student') as any)?.nombre,
      carnet: (enrollment.get('student') as any)?.carnet,
      carrera: (enrollment.get('student') as any)?.carrera,
      genero: (enrollment.get('student') as any)?.genero,
      avatar: (enrollment.get('student') as any)?.avatar,
      email: (enrollment.get('student') as any)?.email,
    }));
  };

  public listProjectStudents = async (projectId: string | number) => {
    const enrollments = await this.listEnrollmentsByProjectId(projectId);
    return enrollments.map((enrollment) => ({
      nombre: enrollment.nombre,
      carrera: enrollment.carrera,
      cargo: enrollment.cargo,
      avatar: enrollment.avatar ?? enrollment.nombre?.split(' ').map((word: string) => word[0]).join('').substring(0, 2).toUpperCase(),
    }));
  };

  public getProjectEnrollmentStats = async (projectId: string | number) => {
    const [project, enrollments] = await Promise.all([
      this.getProjectById(projectId),
      this.listEnrollmentsByProjectId(projectId),
    ]);

    if (!project) return null;

    return {
      ...project,
      estudiantesAsignados: enrollments.length,
      cuposOcupados: enrollments.length,
      cuposTexto: project.cuposTotales != null ? `${enrollments.length} de ${project.cuposTotales}` : `${enrollments.length} ocupados`,
    };
  };

  public createProject = async (body: Record<string, unknown>) => {
    const statusCandidate = normalizeText(body.estado) || 'Activo';
    const estado = allowedStatuses.includes(statusCandidate as ProjectStatus) ? (statusCandidate as ProjectStatus) : 'Activo';
    const cuposValue = Number(body.cupos);
    const faculty = normalizeText(body.facultad);
    const careers = Array.isArray(body.carreras)
      ? body.carreras.map((career) => normalizeText(career)).filter(Boolean)
      : normalizeText(body.carrera)
        ? [normalizeText(body.carrera)]
        : [];
    const students = collectStudents(body);

    if (!faculty) {
      throw new HttpError(400, 'Missing required fields: facultad');
    }

    if (careers.length === 0) {
      throw new HttpError(400, 'Missing required fields: carreras');
    }

    //if (students.length === 0) {
    //  throw new HttpError(400, 'Missing required fields: students');
    //}

    const transaction = await sequelize.transaction();
    try {
      const institution = await resolveInstitution(body, transaction);

      const project = await Project.create(
        {
          institution_id: institution.id,
          titulo: normalizeText(body.titulo),
          ubicacion: normalizeText(body.ubicacion),
          estado,
          facultad: faculty,
          carreras: careers,
          descripcion: normalizeText(body.descripcion),
          resumen: normalizeText(body.resumen) || null,
          fecha_inicio: normalizeText(body.fechaInicio) || null,
          fecha_cierre: normalizeText(body.fechaCierre) || null,
          cupos: Number.isFinite(cuposValue) ? cuposValue : null,
          image_url: normalizeText(body.image) || null,
          team_members: students.map((student) => student.nombre),
          personas: students.length,
        },
        { transaction }
      );

      for (const studentDraft of students) {
        // Student.upsert() resuelve por PK (UUID), no por carnet → unique constraint error.
        // Usamos SQL raw con ON CONFLICT (carnet) para manejar estudiantes existentes.
        const studentRows = await sequelize.query<{ id: string }>(
          `INSERT INTO students (id, nombre, carnet, carrera, genero, avatar, email, created_at)
           VALUES (gen_random_uuid(), :nombre, :carnet, :carrera, :genero, :avatar, :email, NOW())
           ON CONFLICT (carnet) DO UPDATE SET
             nombre  = EXCLUDED.nombre,
             carrera = EXCLUDED.carrera,
             genero  = EXCLUDED.genero,
             avatar  = COALESCE(EXCLUDED.avatar, students.avatar),
             email   = COALESCE(EXCLUDED.email,  students.email)
           RETURNING id`,
          {
            replacements: {
              nombre: studentDraft.nombre,
              carnet: studentDraft.carnet,
              carrera: studentDraft.carrera || careers[0] || '',
              genero: (studentDraft.genero === 'Masculino' || studentDraft.genero === 'Femenino')
                ? studentDraft.genero : null,
              avatar: studentDraft.avatar || null,
              email:  studentDraft.email  || null,
            },
            type: QueryTypes.SELECT,
            transaction,
          }
        );
        const studentId = (studentRows[0] as any).id;

        await sequelize.query(
          `INSERT INTO project_enrollments (id, project_id, student_id, cargo, activo, created_at)
           VALUES (gen_random_uuid(), :project_id, :student_id, 'Estudiante', true, NOW())
           ON CONFLICT (project_id, student_id) DO UPDATE SET activo = true`,
          {
            replacements: { project_id: project.id, student_id: studentId },
            type: QueryTypes.INSERT,
            transaction,
          }
        );
      }

      await transaction.commit();
      return this.getProjectById(project.id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  public enrollStudent = async (projectId: string | number, body: Record<string, unknown>) => {
    const project = await this.getProjectById(projectId);
    if (!project) return null;

    const numericProjectId = Number(projectId);
    if (!Number.isInteger(numericProjectId)) {
      throw new HttpError(400, 'Invalid project id');
    }

    const transaction = await sequelize.transaction();
    try {
      // Student.upsert() resuelve por PK (UUID), no por carnet → unique constraint error.
      const studentRows = await sequelize.query<{ id: string }>(
        `INSERT INTO students (id, nombre, carnet, carrera, genero, avatar, email, created_at)
         VALUES (gen_random_uuid(), :nombre, :carnet, :carrera, :genero, :avatar, :email, NOW())
         ON CONFLICT (carnet) DO UPDATE SET
           nombre  = EXCLUDED.nombre,
           carrera = EXCLUDED.carrera,
           genero  = EXCLUDED.genero,
           avatar  = COALESCE(EXCLUDED.avatar, students.avatar),
           email   = COALESCE(EXCLUDED.email,  students.email)
         RETURNING id`,
        {
          replacements: {
            nombre: String(body.nombre),
            carnet: String(body.carnet),
            carrera: String(body.carrera),
            genero: (body.genero === 'Masculino' || body.genero === 'Femenino') ? body.genero : null,
            avatar: typeof body.avatar === 'string' ? body.avatar : null,
            email:  typeof body.email  === 'string' ? body.email  : null,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const studentId = (studentRows[0] as any).id;

      const enrollmentRows = await sequelize.query<{ id: string }>(
        `INSERT INTO project_enrollments (id, project_id, student_id, cargo, activo, created_at)
         VALUES (gen_random_uuid(), :project_id, :student_id, :cargo, :activo, NOW())
         ON CONFLICT (project_id, student_id) DO UPDATE SET
           cargo  = EXCLUDED.cargo,
           activo = EXCLUDED.activo
         RETURNING id`,
        {
          replacements: {
            project_id: numericProjectId,
            student_id: studentId,
            cargo:  typeof body.cargo  === 'string'  ? body.cargo  : 'Estudiante',
            activo: typeof body.activo === 'boolean' ? body.activo : true,
          },
          type: QueryTypes.SELECT,
          transaction,
        }
      );
      const enrollmentId = (enrollmentRows[0] as any).id;

      // Recalcular el estado del proyecto para que la barra de cupos cambie al instante.
      // personas = cantidad de inscripciones activas; team_members = lista de nombres activos.
      const activeEnrollments = await ProjectEnrollment.findAll({
        where: { project_id: numericProjectId, activo: true },
        include: [{ model: Student, as: 'student', required: true }],
        transaction,
      });

      const activeNames = activeEnrollments
        .map((item) => (item.get('student') as any)?.nombre)
        .filter(Boolean)
        .map((name) => String(name));

      await Project.update(
        {
          personas: activeEnrollments.length,
          team_members: activeNames,
        },
        {
          where: { id: numericProjectId },
          transaction,
        }
      );

      await transaction.commit();

      // return updated project detail so callers can refresh UI easily
      const updated = await this.getProjectById(numericProjectId);
      return { project: updated, studentId, enrollmentId };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  };

  public updateProject = async (projectId: string | number, body: Record<string, unknown>) => {
    const projectModel = await Project.findByPk(projectId, { include: [{ model: Institution, as: 'institution' }] });
    if (!projectModel) throw new HttpError(404, 'Project not found');

    const transaction = await sequelize.transaction();
    try {
      const statusCandidate = mapVisibleStatusToProjectStatus(body.estado ?? body.status);

      // allow updating institution if provided — always pass the project's current institution_id
      // so resolveInstitution updates that institution instead of creating a new one
      if (body.institutionName) {
        const bodyWithId = {
          ...body,
          institutionId: body.institutionId ?? projectModel.institution_id,
        };
        await resolveInstitution(bodyWithId, transaction);
      }

      await projectModel.update(
        {
          titulo: normalizeText(body.titulo) || projectModel.titulo,
          ubicacion: normalizeText(body.ubicacion) || projectModel.ubicacion,
          descripcion: normalizeText(body.descripcion) || projectModel.descripcion,
          resumen: normalizeText(body.resumen) || projectModel.resumen,
          fecha_inicio: normalizeText(body.fechaInicio) || projectModel.fecha_inicio,
          fecha_cierre: normalizeText(body.fechaCierre) || projectModel.fecha_cierre,
          cupos: typeof body.cupos !== 'undefined' ? Number(body.cupos) : projectModel.cupos,
          estado: statusCandidate ?? projectModel.estado,
          image_url: normalizeText(body.projectImage ?? body.image ?? body.imageUrl ?? body.imagen) || projectModel.image_url,
          facultad: normalizeText(body.facultad) || projectModel.facultad,
          carreras: Array.isArray(body.carreras) ? body.carreras : projectModel.carreras,
        },
        { transaction }
      );

      await transaction.commit();
      return this.getProjectById(projectId);
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  };

  public listMapMarkers = async () => {
    const markers = await MapMarker.findAll({ order: [['label', 'ASC']] });
    return markers.map((marker) => ({
      id: marker.id,
      label: marker.label,
      hombres: marker.hombres,
      mujeres: marker.mujeres,
      lat: Number(marker.lat),
      lng: Number(marker.lng),
      projectId: marker.project_id ?? null,
    }));
  };

  public listStudentDirectory = async () => {
    const projects = await this.listProjects();
    return projects.map((project) => ({
      titulo: project.titulo,
      facultad: project.facultad ?? 'General',
      ubicacion: project.ubicacion.split(',')[0] ?? project.ubicacion,
      estudiantes: [],
    }));
  };

  public getDashboardSummary = async () => {
    const [totalInstitutions, totalProjects, totalActiveEnrollments, totalMarkers] = await Promise.all([
      Institution.count(),
      Project.count(),
      ProjectEnrollment.count({ where: { activo: true } }),
      MapMarker.count(),
    ]);

    const projectsByStatus = await Project.findAll({
      attributes: ['estado', [sequelize.fn('COUNT', sequelize.col('estado')), 'total']],
      group: ['estado'],
      raw: true,
    });

    return {
      totalInstitutions,
      totalProjects,
      totalActiveEnrollments,
      totalMarkers,
      projectsByStatus,
    };
  };

  public removeEnrollment = async (projectId: string | number, enrollmentId: string) => {
  const enrollment = await ProjectEnrollment.findOne({
    where: { id: enrollmentId, project_id: projectId },
  });
  if (!enrollment) throw new HttpError(404, 'Enrollment not found');

  const transaction = await sequelize.transaction();
  try {
    await enrollment.destroy({ transaction });

    // Recalcular personas y team_members
    const activeEnrollments = await ProjectEnrollment.findAll({
      where: { project_id: projectId, activo: true },
      include: [{ model: Student, as: 'student', required: true }],
      transaction,
    });
    const activeNames = activeEnrollments
      .map((e) => (e.get('student') as any)?.nombre)
      .filter(Boolean)
      .map(String);

    await Project.update(
      { personas: activeEnrollments.length, team_members: activeNames },
      { where: { id: projectId }, transaction }
    );

    await transaction.commit();
    return { deleted: true, enrollmentId };
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
};

public updateEnrollment = async (
    projectId: string | number,
    enrollmentId: string,
    body: Record<string, unknown>
  ) => {
    const enrollment = await ProjectEnrollment.findOne({
      where: { id: enrollmentId, project_id: projectId },
    });
    if (!enrollment) throw new HttpError(404, 'Enrollment not found');

    const studentId = enrollment.get('student_id') as string | number;
    const student = await Student.findByPk(studentId);
    if (!student) throw new HttpError(404, 'Student not found');

    await student.update({
      nombre: typeof body.nombre === 'string' ? body.nombre : student.get('nombre'),
      carnet:  typeof body.carnet  === 'string' ? body.carnet  : student.get('carnet'),
      carrera: typeof body.carrera === 'string' ? body.carrera : student.get('carrera'),
      genero:  (body.genero === 'Masculino' || body.genero === 'Femenino') ? body.genero : null,
      email:   typeof body.email   === 'string' && body.email ? body.email : null,
    });

    const activeEnrollments = await ProjectEnrollment.findAll({
      where: { project_id: projectId, activo: true },
      include: [{ model: Student, as: 'student', required: true }],
    });
    const activeNames = activeEnrollments
      .map((e) => (e.get('student') as any)?.nombre)
      .filter(Boolean)
      .map(String);

    await Project.update(
      { team_members: activeNames },
      { where: { id: projectId } }
    );

    return {
      id: enrollment.get('id'),
      student_id: student.get('id'),
      nombre:  student.get('nombre'),
      carnet:  student.get('carnet'),
      carrera: student.get('carrera'),
      genero:  student.get('genero') ?? null,
      email:   student.get('email')  ?? null,
    };
  };

  public deleteProject = async (projectId: string | number) => {
    const project = await Project.findByPk(projectId);
    if (!project) throw new HttpError(404, 'Project not found');

    const transaction = await sequelize.transaction();
    try {
      await ProjectEnrollment.destroy({ where: { project_id: projectId }, transaction });
      await project.destroy({ transaction });
      await transaction.commit();
      return { deleted: true, projectId };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  };
}

export const projectsService = new ProjectsService();
export default ProjectsService;