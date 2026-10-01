import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../core/config/database.js';

export interface StudentAttributes {
  id: string;
  nombre: string;
  carnet: string;
  carrera: string;
  genero?: 'Masculino' | 'Femenino' | null;
  avatar?: string | null;
  email?: string | null;
  created_at?: Date;
}

export interface StudentCreationAttributes extends Optional<StudentAttributes, 'id' | 'genero' | 'avatar' | 'email' | 'created_at'> {}

class Student extends Model<StudentAttributes, StudentCreationAttributes> implements StudentAttributes {
  declare id: string;
  declare nombre: string;
  declare carnet: string;
  declare carrera: string;
  declare genero: 'Masculino' | 'Femenino' | null;
  declare avatar: string | null;
  declare email: string | null;
  declare created_at: Date;

  public static associate(models: any): void {
    Student.hasMany(models.ProjectEnrollment, {
      foreignKey: 'student_id',
      as: 'enrollments',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }
}

Student.init(
  {
    id: {
      type: DataTypes.UUID,
      primaryKey: true,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4,
    },
    nombre: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    carnet: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    carrera: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    genero: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    avatar: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    email: {
      type: DataTypes.TEXT,
      allowNull: true,
      unique: true,
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: 'Student',
    tableName: 'students',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
  }
);

export default Student;