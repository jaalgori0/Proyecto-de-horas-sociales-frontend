import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../core/config/database.js';

export interface FacultyAttributes {
  id: number;
  nombre: string;
}

export interface FacultyCreationAttributes extends Optional<FacultyAttributes, 'id'> {}

class Faculty extends Model<FacultyAttributes, FacultyCreationAttributes> implements FacultyAttributes {
  declare id: number;
  declare nombre: string;

  public static associate(models: any): void {
    Faculty.hasMany(models.Career, {
      foreignKey: 'faculty_id',
      as: 'careers',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }
}

Faculty.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    nombre: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
  },
  {
    sequelize,
    modelName: 'Faculty',
    tableName: 'faculties',
    timestamps: true,
    underscored: false,
  }
);

export default Faculty;