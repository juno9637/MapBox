export class EventBus{
    constructor(){
        this.listeners = new Map();
    }

    subscribe(eventName, listener){
        if (!this.listeners.has(eventName)) {
            this.listeners.set(eventName, new Set());
        }

        this.listeners.get(eventName).add(listener);
    }

    remove(eventName, listener){
        if(this.listeners.has(eventName)){
            this.listeners.delete(listener);
        }
    }

    notify(eventName, data){
        const listeners = this.listeners.get(eventName);
        if (!listeners) return;

        listeners.forEach((listener) => {
            try {
                listener(data);
            } catch (error) {
                console.error(`Error notifying listener for event ${eventName}:`, error);
            }
        });
    }
}