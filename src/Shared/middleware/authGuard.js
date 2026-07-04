/** 
 * RBAC guard - assumes req.user is already authenticated + verified upstream 
 * @param {string|string[]} allowedRoles - Roles allowed. [] = any authenticated user. 
 * @param {object} [options={}] 
 * @param {boolean} [options.leakDetails=false] - Include required roles in 403. 
 * @param {boolean} [options.requireAll=false] - User must have ALL roles vs ANY. 
 */
export const authGuard = (allowedRoles = [], { leakDetails = false, requireAll = false } = {}) => {  
  let requiredRoles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];  
  requiredRoles = requiredRoles   
    .map(r => typeof r === 'string' ? r.trim().toLowerCase() : '')   
    .filter(Boolean);  
  
  const inputWasPassedButEvaluatedEmpty = allowedRoles && allowedRoles.length > 0 && requiredRoles.length === 0;  

  return (req, res, next) => {    
    // 1. Structural Authentication Guard
    if (!req.user?.id) {      
      return res.status(401).json({        
        error: 'Unauthorized',        
        code: 'NOT_AUTHENTICATED',        
        message: 'Authentication required'      
      });    
    }    

    // 2. Normalize user roles to array format safely
    const userRolesRaw = Array.isArray(req.user.roles)     
      ? req.user.roles      
      : [req.user.role].filter(Boolean);    
    
    const userRoles = userRolesRaw     
      .map(r => typeof r === 'string' ? r.trim().toLowerCase() : '')     
      .filter(Boolean);    

    // 3. Defensive Check: Has the user been assigned *any* identity role?
    const userHasNoAssignedRoles = userRoles.length === 0;

    // 4. RBAC Evaluation Matrix
    const isAccessDenied = 
      inputWasPassedButEvaluatedEmpty ||
      userHasNoAssignedRoles || // CRITICAL FIX: Block access if user has no roles assigned at all
      (requiredRoles.length && (
        requireAll           
          ? !requiredRoles.every(r => userRoles.includes(r))            
          : !requiredRoles.some(r => userRoles.includes(r))
      ));

    if (isAccessDenied) {      
      req.log?.warn({        
        userId: req.user.id,        
        required: requiredRoles,        
        actual: userRolesRaw,        
        path: req.path,        
        method: req.method      
      }, 'RBAC denied');      

      return res.status(403).json({        
        error: 'Forbidden',        
        code: 'INSUFFICIENT_ROLE',        
        message: leakDetails         
          ? `Requires role: ${requiredRoles.join(requireAll ? ' and ' : ' or ')}`          
          : 'Insufficient privileges'      
      });    
    }    

    next();  
  };
};