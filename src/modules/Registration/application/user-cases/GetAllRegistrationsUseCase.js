// src/application/use-cases/GetAllRegistrationsUseCase.js
import { UnauthorizedError } from '../../domain/errors/DomainErrors.js';

export class GetAllRegistrationsUseCase {
  constructor({ registrationRepository, conferenceRepository }) {
    this.registrationRepository = registrationRepository;
    this.conferenceRepository = conferenceRepository; 
  }

  async execute({
    page = 1,
    limit = 20,
    conferenceId,
    userId,
    status,
    ticketTier,
    sortBy = 'createdAt',
    sortOrder = 'DESC'
  } = {}, currentUser) {
    
    // 1. Enforce Strict Data Scoping (Authorization Guard)
    if (!currentUser.isAdmin()) {
      
      if (currentUser.isAttendee()) {
        if (!userId || userId !== currentUser.id) {
          throw new UnauthorizedError("Unauthorized: You can only view your own registrations.");
        }
      } 
      
      else if (currentUser.isOrganizer()) {
        if (!conferenceId) {
          throw new UnauthorizedError("Unauthorized: Organizers must provide a specific conferenceId filter.");
        }
        
        const isOwner = await this.conferenceRepository.isOrganizerOf(conferenceId, currentUser.id);
        if (!isOwner) {
          throw new UnauthorizedError("Unauthorized: You do not have permission to view this conference's roster.");
        }
      } 
      
      else {
        throw new UnauthorizedError("Unauthorized: Unknown user clearance role.");
      }
    }

    // 2. Structural Layer Defense & Coercion
    const sanitizedPage = Math.max(1, Math.floor(Number(page)) || 1);
    const sanitizedLimit = Math.min(Math.max(1, Math.floor(Number(limit)) || 20), 100);

    // 3. Security Whitelisting (Defended against TypeError crashes)
    const ALLOWED_SORT_FIELDS = ['createdAt', 'status'];
    const finalSortBy = ALLOWED_SORT_FIELDS.includes(sortBy) ? sortBy : 'createdAt';
    
    const stringSortOrder = String(sortOrder || 'DESC').toUpperCase();
    const finalSortOrder = ['ASC', 'DESC'].includes(stringSortOrder) ? stringSortOrder : 'DESC';

    // 4. Safe Multi-Tenant Filter Assembly
    let finalUserIdFilter = userId;
    
    if (currentUser.isAttendee()) {
      finalUserIdFilter = currentUser.id; // Lock down isolation completely
    } else if (currentUser.isOrganizer()) {
      finalUserIdFilter = undefined; // Force remove global user scouting loops unless explicitly designed
    }

    const queryFilters = {
      page: sanitizedPage,
      limit: sanitizedLimit,
      conferenceId,
      userId: finalUserIdFilter,
      status,
      ticketTier,
      sortBy: finalSortBy,
      sortOrder: finalSortOrder
    };

    // 5. Database Fetch Execution
    const result = await this.registrationRepository.findAll(queryFilters);

    return {
      registrations: result.items,
      pagination: {
        page: sanitizedPage,
        limit: sanitizedLimit,
        totalItems: result.totalItems,
        totalPages: result.totalPages
      }
    };
  }
}