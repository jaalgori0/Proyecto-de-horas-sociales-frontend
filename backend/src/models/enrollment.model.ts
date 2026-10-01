import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../core/config/database.js';

export interface ProjectEnrollmentAttributes {
  id: string;
  project_id: number;
  student_id: string;
  cargo: string;
  activo: boolean;
  created_at?: Date;
}

export interface ProjectEnrollmentCreationAttributes
  extends Optional<ProjectEnrollmentAttributes, 'id' | 'cargo' | 'activo' | 'created_at'> {}

class ProjectEnrollment
  extends Model<ProjectEnrollmentAttributes, ProjectEnrollmentCreationAttributes>
  implements ProjectEnrollmentAttributes
{
  declare id: string;
  declare project_id: number;
  declare student_id: string;
  declare cargo: string;
  declare activo: boolean;
  declare created_at: Date;

  public static associate(models: any): void {
    ProjectEnrollment.belongsTo(models.Project, {
      foreignKey: 'project_id',
      as: 'project',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
    ProjectEnrollment.belongsTo(models.Student, {
      foreignKey: 'student_id',
      as: 'student',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }
}

ProjectEnrollment.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    project_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'projects',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    student_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'students',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    cargo: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: 'Estudiante',
    },
    activo: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'ProjectEnrollment',
    tableName: 'project_enrollments',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['project_id', 'student_id'], // <-- Esto le dice a Postgres que cree la restricción única requerida
      },
    ],
  }
);

export default ProjectEnrollment;
