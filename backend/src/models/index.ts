import sequelize from '../core/config/database.js';
import Institution from './institution.model.js';
import Project from './project.model.js';
import Student from './student.model.js';
import ProjectEnrollment from './enrollment.model.js';
import MapMarker from './marker.model.js';
import User from './user.model.js'; 
import Faculty from './faculty.model.js';
import Career from './career.model.js';

const models = {
  Institution,
  Project,
  Student,
  ProjectEnrollment,
  MapMarker,
  User,
  Faculty,
  Career,
};

Object.values(models).forEach((model) => {
  if (typeof (model as any).associate === 'function') {
    (model as any).associate(models as any);
  }
});

export { sequelize };
export default models;