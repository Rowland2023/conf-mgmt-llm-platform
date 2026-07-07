/**
 * Validates incoming request parts against Joi schemas atomically.
 * Production ready for Express 4 and Express 5 modern applications.
 */
export const validate = (schema) => {  
  if (!schema || typeof schema !== 'object') {    
    throw new Error('Joi validation guard requires a valid schema object mapping.');  
  }  

  return (req, res, next) => {    
    const locations = ['body', 'params', 'query'];    
    const validatedData = {};    
    const allErrors = [];    

    for (const location of locations) {      
      const locationSchema = schema[location];      
      if (!locationSchema) continue;      

      if (typeof locationSchema.validate !== 'function') {        
        return next(new Error(`Invalid Joi schema instance for ${location}.`));      
      }      

      // FIXED: Fallback to an empty object if the target location is undefined/null 
      // to ensure Joi evaluates required fields accurately rather than failing blindly
      const inputData = req[location] || {};

      const { error, value } = locationSchema.validate(inputData, {        
        abortEarly: false,        
        convert: true
      });      

      if (error) {        
        const details = error.details.map(err => ({          
          field: err.path.length ? `${location}.${err.path.join('.')}` : location,          
          message: err.message.replace(/"/g, ''), // Strip confusing Joi quotation marks
          location        
        }));        
        allErrors.push(...details);      
      } else {        
        validatedData[location] = value;      
      }    
    }    

    if (allErrors.length) {      
      return res.status(400).json({        
        error: 'Validation Failed',        
        code: 'INVALID_INPUT_STRUCTURE',        
        message: 'Request failed validation.',        
        details: allErrors      
      });    
    }    

    // Atomic assignment processing
    for (const location of Object.keys(validatedData)) {      
      if (location === 'query') {        
        // FIXED: Instead of loop-deleting keys which opens prototype mutation risks, 
        // use Object.defineProperty to cleanly swap out the Express 5 query reference 
        // with a completely secure, frozen/null-prototype data object.
        Object.defineProperty(req, 'query', {
          value: Object.freeze(Object.assign(Object.create(null), validatedData.query)),
          configurable: true,
          enumerable: true,
          writable: false
        });
      } else {        
        req[location] = validatedData[location];      
      }    
    }    

    next();  
  };
};