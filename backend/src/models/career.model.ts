import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../core/config/database.js';

export interface CareerAttributes {
  id: number;
  nombre: string;
  faculty_id: number;
}

export interface CareerCreationAttributes extends Optional<CareerAttributes, 'id'> {}

class Career extends Model<CareerAttributes, CareerCreationAttributes> implements CareerAttributes {
  declare id: number;
  declare nombre: string;
  declare faculty_id: number;

  public static associate(models: any): void {
    Career.belongsTo(models.Faculty, {
      foreignKey: 'faculty_id',
      as: 'faculty',
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });
  }
}

Career.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
    },
    nombre: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    faculty_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'faculties',
        key: 'id',
      },
    },
  },
  {
    sequelize,
    modelName: 'Career',
    tableName: 'careers',
    timestamps: true,
    underscored: false,
  }
);

export default Career;