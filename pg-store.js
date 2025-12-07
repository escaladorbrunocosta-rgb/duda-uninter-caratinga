import { proto } from 'baileys';

const KEY_MAP = {
    'pre-key': 'preKeys',
    'session': 'sessions',
    'sender-key': 'senderKeys',
    'app-state-sync-key': 'appStateSyncKeys',
    'app-state-sync-version': 'appStateVersions',
    'sender-key-memory': 'senderKeyMemory',
};

export class BaileysPgStore {
    constructor(store) {
        this.store = store;
        this.state = {
            creds: {
                // @ts-ignore
                get: (type, id) => this.store.get(`${type}-${id}`),
                set: (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            tasks.push(value ? this.store.set(key, value) : this.store.delete(key));
                        }
                    }
                    return Promise.all(tasks);
                },
            },
            keys: {
                get: (type, ids) => {
                    const data = {};
                    return Promise.all(ids.map(async (id) => {
                        const value = await this.store.get(`${KEY_MAP[type]}-${id}`);
                        if (value) {
                            if (type === 'app-state-sync-key') {
                                data[id] = proto.Message.AppStateSyncKeyData.fromObject(value);
                            } else {
                                data[id] = value;
                            }
                        }
                    })).then(() => data);
                },
                set: (data) => {
                    const tasks = [];
                    for (const type in data) {
                        for (const id in data[type]) {
                            const value = data[type][id];
                            const key = `${KEY_MAP[type]}-${id}`;
                            tasks.push(value ? this.store.set(key, value) : this.store.delete(key));
                        }
                    }
                    return Promise.all(tasks);
                },
            },
        };
    }

    saveCreds() {
        return this.state.creds.set(this.state.creds);
    }

    static async from(store) {
        const self = new BaileysPgStore(store);
        self.state.creds = (await self.store.get('creds')) || self.state.creds;
        return self;
    }
}