import {
	SimplePool,
	nip19,
	type Event as NostrEvent,
	type UnsignedEvent,
	type Sub,
	type Filter,
} from 'nostr-tools';
import { storedLoginpubkey } from './store';

interface Channel {
	name: string
	about: string
	picture: string
	updated_at: number
	id: string
	pubkey: string
	recommendedRelay: string
}

interface Profile {
	name: string
	display_name: string
	about: string
	picture: string
}

// kind:40を取得する
export const getChannels = async (pool: SimplePool, channelEvents: NostrEvent[], channelObjects: {[key: string]: Channel}, relays: string[], metadataEvents: NostrEvent[], channels: Channel[], callbackChannels: Function) => {
	const sub = pool.sub(relays, [{kinds: [40]}]);
	sub.on('event', (ev: NostrEvent) => {
		channelEvents.push(ev);
		channelObjects[ev.id] = JSON.parse(ev.content);
		channelObjects[ev.id].updated_at = ev.created_at;
		channelObjects[ev.id].id = ev.id;
		channelObjects[ev.id].pubkey = ev.pubkey;
		channelObjects[ev.id].recommendedRelay = pool.seenOn(ev.id)[0];
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getChannels * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// kind:41を取得する
		getMetadata(pool, relays, metadataEvents, channels, channelEvents, channelObjects, callbackChannels);
	});
};

// kind:41を取得する
const getMetadata = async (pool: SimplePool, relays: string[], metadataEvents: NostrEvent[], channels: Channel[], channelEvents: NostrEvent[], channelObjects: {[key: string]: Channel}, callbackChannels: Function) => {
	const sub = pool.sub(relays, [{kinds: [41]}]);
	sub.on('event', (ev: NostrEvent) => {
		metadataEvents.push(ev);
//		console.log(ev);
	});
	sub.on('eose', async () => {
		console.log('getMetadata * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 更新すべきkind:41を適用する
		await updateChannels(metadataEvents, channelEvents, channelObjects);
		// 表示を反映させる
		channels = getSortedChannels(channelObjects);
		callbackChannels(channels);
	});
};

// 更新すべきkind:41を適用する
const updateChannels = async(metadataEvents: NostrEvent[], channelEvents: NostrEvent[], channelObjects: {[key: string]: Channel}) => {
	metadataEvents.forEach(m => {
		channelEvents.forEach(c => {
			if (m.pubkey === c.pubkey) {
				m.tags.forEach(tag => {
					if (tag[0] === 'e' && tag[1] === c.id) {
//						console.log('kind:41 replace', channelObjects[c.id], JSON.parse(m.content));
						const savedRecommendedRelay = channelObjects[c.id].recommendedRelay;
						channelObjects[c.id] = JSON.parse(m.content);
						channelObjects[c.id].updated_at = m.created_at;
						channelObjects[c.id].id = c.id;
						channelObjects[c.id].pubkey = c.pubkey;
						channelObjects[c.id].recommendedRelay = savedRecommendedRelay;
					}
				});
			}
		})
	});
};

// 降順にソートされたチャンネル情報の配列を返す
const getSortedChannels = (channelObjects: {[key: string]: Channel}) => {
	const channelArray: Channel[] = Object.values(channelObjects);
	channelArray.sort((a, b) => {
		if (a.updated_at < b.updated_at) {
			return 1;
		}
		if (a.updated_at > b.updated_at) {
			return -1;
		}
		return 0;
	});
	return channelArray;
};

// kind:42, 43, 44を取得する
export const getNotes = async (pool: SimplePool, relays: string[], subNotes: Sub<42 | 43 | 44>, filter: Filter<42 | 43 | 44>[], notes: NostrEvent[], profs: {[key: string]: Profile}, callbackNotes: Function, callbackProfile: Function) => {
	subNotes = pool.sub(relays, filter);
	const pubkeys: Set<string> = new Set();
	let getEOSE = false;
	const update = () => {
		// 時系列順にソートする
		notes.sort((a, b) => {
			if (a.created_at < b.created_at) {
				return -1;
			}
			if (a.created_at > b.created_at) {
				return 1;
			}
			return 0;
		});
		// 表示を反映させる
		callbackNotes(notes);
	};
	subNotes.on('event', (ev: NostrEvent) => {
		notes.push(ev);
		if (getEOSE) {
			update();
			const pubkeysToGet: Set<string> = new Set();
			pubkeysToGet.add(ev.pubkey);
			for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
				pubkeysToGet.add(pubkey);
			}
			const matchesIterator = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIterator) {
				const d = nip19.decode(match[1]);
				if (d.type === 'npub')
					pubkeysToGet.add(d.data);
			}
			const pubkeysToGetArray = Array.from(pubkeysToGet).filter(v => !(v in profs))
			if (pubkeysToGetArray.length > 0) {
				getProfile(pool, relays, Array.from(pubkeysToGetArray), profs, callbackProfile);
			}
		}
		else {
			pubkeys.add(ev.pubkey);
			for (const pubkey of ev.tags.filter(v => v[0] === 'p').map(v => v[1])) {
				pubkeys.add(pubkey);
			}
			const matchesIterator = ev.content.matchAll(/nostr:(npub\w{59})/g);
			for (const match of matchesIterator) {
				const d = nip19.decode(match[1]);
				if (d.type === 'npub')
					pubkeys.add(d.data);
			}
		}
//		console.log(ev);
	});
	subNotes.on('eose', () => {
		console.log('getNotes * EOSE *');
		getEOSE = true;
		update();
		// 投稿の取得が終わったらプロフィールを取得しに行く
		getProfile(pool, relays, Array.from(pubkeys), profs, callbackProfile);
	});
};

// プロフィールを取得する
export const getProfile = async (pool: SimplePool, relays: string[], pubkeys: string[], profs: {[key: string]: Profile}, callbackProfile: Function) => {
	const sub = pool.sub(relays, [{kinds: [0], authors: pubkeys}]);
	sub.on('event', (ev: NostrEvent) => {
		profs[ev.pubkey] = JSON.parse(ev.content);
//		console.log(ev);
	});
	sub.on('eose', () => {
		console.log('getProfile * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		callbackProfile(profs);
	});
};

// ミュートリストを取得する
export const getMutelist = async (pool: SimplePool, relays: string[], pubkey: string, callbackMuteList: Function) => {
	let muteList: string[];
	const sub = pool.sub(relays, [{kinds: [10000], authors: [pubkey]}]);
	sub.on('event', (ev: NostrEvent) => {
		muteList = ev.tags.filter(v => v[0] === 'p').map(v => v[1]);
	});
	sub.on('eose', () => {
		console.log('getMutelist * EOSE *');
		//取得できたらもう用済みなのでunsubする
		sub.unsub();
		// 表示を反映させる
		callbackMuteList(muteList);
	});
};

let loginPubkey: string;
storedLoginpubkey.subscribe((value) => {
	loginPubkey = value;
});

export const sendFav = async(pool: SimplePool, relaysToWrite: string[], noteid: string, targetPubkey: string) => {
	const savedloginPubkey = loginPubkey;
	storedLoginpubkey.set('');
	const tags = [['p', targetPubkey, ''], ['e', noteid, '', '']];
	const baseEvent: UnsignedEvent = {
		kind: 7,
		pubkey: '',
		created_at: Math.floor(Date.now() / 1000),
		tags: tags,
		content: '+'
	};
	const newEvent: NostrEvent = await (window as any).nostr.signEvent(baseEvent);
	const pubs = pool.publish(relaysToWrite, newEvent);
	await Promise.all(pubs);
	storedLoginpubkey.set(savedloginPubkey);
}