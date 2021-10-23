import { services, commands, encodeMessageMeta, BytesToMessages, MessageBuffer, MessageRegistry, messageMeta, Message, Msg, SentMessageI, ReceivedMessageI, ReceivedReplyI } from './twine-common';

// message logger collects messages for debugging use.

type LoggedMessage = {
	raw: messageMeta,
	is_local: boolean,
	is_sent: boolean,
	cmd_str: string,
	reg_m: Msg,
	ts: Date,
	i: Number
}

export default class MessageLogger {
	record = false;
	messages: LoggedMessage[]  = [];
	cur_i = 0;

	constructor(private msgReg:MessageRegistry) {
		this.record = !!window.sessionStorage.getItem('twine_logger_record');
	}
	startRecord() {
		this.record = true;
		window.sessionStorage.setItem('twine_logger_record', "record");
	}
	stopRecord() {
		this.record = false;
		window.sessionStorage.setItem('twine_logger_record', "");
	}

	logReceived(raw:messageMeta, reg_m:Msg) {
		this.logMessage(raw, reg_m, false);
	}
	logSent(raw:messageMeta, reg_m:Msg) {
		this.logMessage(raw, reg_m, true);
	}
	logMessage(raw:messageMeta, reg_m:Msg, is_sent:boolean) {
		if( !this.record ) return;

		const lm:LoggedMessage = {
			raw,
			is_local: this.msgReg.msgIDIsLocal(raw.msgID),
			is_sent,
			cmd_str: getCommandString(raw),
			reg_m,
			ts: new Date(),
			i: this.cur_i
		}
		this.messages.push(lm);
		++this.cur_i;
	}

	out() :MessagesOut {
		return new MessagesOut(this.messages, this.msgReg);
	}
}

function getCommandString( raw:messageMeta ) :string {
	let cmd_str = "?";
	let s: keyof typeof services;
	for( s in services ) {
		if( services[s] == raw.service ) {
			cmd_str = s;
			break;
		}
	}
	let c: keyof typeof commands;
	for( c in commands ) {
		if( commands[c] == raw.command ) {
			cmd_str += " > " + c;
			break;
		}
	}
	return cmd_str;
}

class MessagesOut {
	private grouped_messages : LoggedMessage[][] | undefined;

	constructor(private messages:LoggedMessage[], private msgReg:MessageRegistry){}

	// filters:
	open() :MessagesOut {
		this.messages = this.messages.filter( m => !m.reg_m.closed );
		return this;
	}
	closedInRegistry() :MessagesOut {
		this.messages = this.messages.filter( m => {
			if( m.reg_m.closed ) {
				try {
					this.msgReg.getMessageData(m.raw.msgID)
				}
				catch(e) {
					return false;
				}
				return true;
			}
		});
		return this;
	}

	// stacking: 
	groupMsgID() :MessagesOut {
		const gs:LoggedMessage[][] = [];
		this.messages.forEach( m => {
			let found = false;
			if( m.raw.service === services.reply || m.raw.service === services.close ) {
				// it's a reply, so the thing it is replying to should be in the stack already.
				// actually have to go backwards, and take the first match (because ids get reused)
				for( let i = gs.length -1; i>=0; --i ) {
					const g = gs[i];
					if( g.length > 0 && g[0].raw.msgID === m.raw.msgID ) {
						g.push(m);
						found = true;
						break;
					}
				}
				if( !found ) gs.push([m]);
			}
			else {
				gs.push([m]);
			}
		});
		this.grouped_messages = gs;
		return this;
	}

	// print:
	print() {
		if( this.grouped_messages ) console.table(this.grouped_messages);
		else console.table( this.messages.map(makeMessageOut) );
	}
}

type LoggedMessageFlat = {
	service: number,
    command: number,
	cmd_str: string,
    msgID: number,
    refMsgID: number,
    payload: number,

	is_local: boolean,
	is_sent: boolean,
	is_open: boolean,
	
	//ts: Date,
	i: Number
}

function makeMessageOut( m:LoggedMessage) :LoggedMessageFlat {
	const out :LoggedMessageFlat = {
		service: m.raw.service,
    	command: m.raw.command,
		cmd_str: m.cmd_str,
    	msgID: m.raw.msgID,
    	refMsgID: m.raw.refMsgID,
    	payload: m.raw.payload ? m.raw.payload.length : 0,
		is_local: m.is_local,
		is_sent: m.is_sent,
		is_open: !m.reg_m.closed,
		i: m.i,
		//ts: m.ts
	}

	return out;
}