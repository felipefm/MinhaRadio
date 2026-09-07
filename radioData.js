/**
 * RadioAnalytics - Módulo para rastreamento de estatísticas de rádios
 * Funcionalidades: Contagem de clicks e tempo de escuta por estação
 */

class RadioAnalytics {
    constructor() {
        this.dbName = 'radioAnalyticsDB';
        this.dbVersion = 1;
        this.db = null;
        this.currentSession = null;
        this.sessionStartTime = null;
        this.isEnabled = true;
        
        this.init();
    }

    async init() {
        try {
            await this.initDB();
            console.log('RadioAnalytics: Inicializado com sucesso');
        } catch (error) {
            console.error('RadioAnalytics: Erro na inicialização:', error);
            this.isEnabled = false;
        }
    }

    initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                if (!db.objectStoreNames.contains('analytics')) {
                    const store = db.createObjectStore('analytics', { keyPath: 'stationId' });
                    store.createIndex('name', 'name', { unique: false });
                    store.createIndex('clicks', 'clicks', { unique: false });
                    store.createIndex('totalTime', 'totalTime', { unique: false });
                }
            };
        });
    }

    // Registra um click na rádio
    async recordClick(station) {
        if (!this.isEnabled || !station) return;
        
        try {
            const stationId = station.stationuuid;
            const existing = await this.getStationData(stationId);
            
            const data = {
                stationId: stationId,
                name: station.name,
                url: station.url_resolved,
                clicks: (existing?.clicks || 0) + 1,
                totalTime: existing?.totalTime || 0,
                lastPlayed: new Date().toISOString(),
                firstPlayed: existing?.firstPlayed || new Date().toISOString()
            };
            
            await this.saveStationData(data);
        } catch (error) {
            console.error('RadioAnalytics: Erro ao registrar click:', error);
        }
    }

    // Inicia sessão de escuta
    startListeningSession(station) {
        if (!this.isEnabled || !station) return;
        
        this.currentSession = {
            stationId: station.stationuuid,
            station: station,
            startTime: Date.now()
        };
        this.sessionStartTime = Date.now();
    }

    // Finaliza sessão e registra tempo
    async endListeningSession() {
        if (!this.isEnabled || !this.currentSession) return;
        
        try {
            const sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000); // em segundos
            
            if (sessionDuration > 5) { // Só conta se ouviu por mais de 5 segundos
                const stationId = this.currentSession.stationId;
                const existing = await this.getStationData(stationId);
                
                const data = {
                    stationId: stationId,
                    name: this.currentSession.station.name,
                    url: this.currentSession.station.url_resolved,
                    clicks: existing?.clicks || 0,
                    totalTime: (existing?.totalTime || 0) + sessionDuration,
                    lastPlayed: new Date().toISOString(),
                    firstPlayed: existing?.firstPlayed || new Date().toISOString()
                };
                
                await this.saveStationData(data);
            }
        } catch (error) {
            console.error('RadioAnalytics: Erro ao finalizar sessão:', error);
        } finally {
            this.currentSession = null;
            this.sessionStartTime = null;
        }
    }

    async getStationData(stationId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const request = store.get(stationId);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async saveStationData(data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readwrite');
            const store = transaction.objectStore('analytics');
            const request = store.put(data);
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Obtém top rádios por clicks
    async getTopByClicks(limit = 10) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const index = store.index('clicks');
            const request = index.openCursor(null, 'prev');
            
            const results = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Obtém top rádios por tempo
    async getTopByTime(limit = 10) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const index = store.index('totalTime');
            const request = index.openCursor(null, 'prev');
            
            const results = [];
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && results.length < limit) {
                    results.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(results);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Formata tempo em formato legível
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    // Exporta dados para JSON
    async exportData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readonly');
            const store = transaction.objectStore('analytics');
            const request = store.getAll();
            
            request.onsuccess = () => {
                const data = {
                    exportDate: new Date().toISOString(),
                    totalStations: request.result.length,
                    stations: request.result
                };
                resolve(data);
            };
            request.onerror = () => reject(request.error);
        });
    }

    // Limpa todos os dados
    async clearAllData() {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['analytics'], 'readwrite');
            const store = transaction.objectStore('analytics');
            const request = store.clear();
            
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Desabilita/habilita o módulo
    setEnabled(enabled) {
        this.isEnabled = enabled;
        if (!enabled && this.currentSession) {
            this.endListeningSession();
        }
    }
}

// Instância global
window.radioData = new RadioAnalytics();