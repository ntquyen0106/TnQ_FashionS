import * as adminUserService from '../services/admin-user.service.js';

/* -------------------- ADMIN USER MANAGEMENT -------------------- */

export const postCreateUser = async (req, res) => {
  try {
    const result = await adminUserService.createUser(req.body);
    return res.status(201).json(result);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = {};
      for (const key in err.errors) {
        errors[key] = err.errors[key].message;
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }
    return res.status(err.status || 500).json({ 
      message: err.message, 
      errors: err.errors || null 
    });
  }
};

export const putUpdateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminUserService.updateUser(id, req.body);
    return res.status(200).json(result);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = {};
      for (const key in err.errors) {
        errors[key] = err.errors[key].message;
      }
      return res.status(400).json({
        message: 'Validation failed',
        errors,
      });
    }
    return res.status(err.status || 500).json({ 
      message: err.message, 
      errors: err.errors || null 
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await adminUserService.getUserById(id);
    return res.json(user);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const result = await adminUserService.getUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ 
      message: err.message, 
      errors: err.errors || null 
    });
  }
};

export const deleteOneUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await adminUserService.deleteUser(id);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(err.status || 500).json({ 
      message: err.message, 
      errors: err.errors || null 
    });
  }
};