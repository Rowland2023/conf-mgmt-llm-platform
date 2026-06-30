
export class CreateEventUseCase{

    constructor(eventRepository,outboxRepository){
        this.eventRepository=eventRepository;
        this.outboxRepository=outboxRepository;
    }   
    async execute(command){
        const {title,roomID,startTime,endTime}=command;

        return await this.eventRepository.manager.transaction(async (trx)=>{
            const hasConflict= await this.eventRepository.existsOverlappingEvent(roomID,startTime,endTime);
            if(hasConflict){
                throw new Error("Room already has a scheduled event");
            }
            const event = this.eventRepository.create({title,roomID,startTime,endTime});
            await trx.save(event)
        //  Change payload= to payload:
const outboxEntry = {
  eventId: "EventCreated",
  payload: { eventId: event.id, title, roomID, startTime, endTime },
  processed: false
};
        
        return { eventId: event.id };
        });
    }
}