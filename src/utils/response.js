// src/utils/response.js - Response Helper Functions

/**
 * Success Response
 */
const successResponse = (res, message = 'Success', data = null, statusCode = 200) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error Response
 */
const errorResponse = (res, message = 'Error', statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors !== null) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

module.exports = {
  successResponse,
  errorResponse
};