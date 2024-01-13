import EventEmitter from "events";

export class ConsoleIO {
  eventEmiter: EventEmitter;
  buff: string;
  constructor() {
    this.eventEmiter = new EventEmitter();
    this.buff = "";
    process.stdin.setEncoding('utf8');
    this.readLine();
  }
  readLine() {
    var onData = (data) => {
      this.buff += data;
      if (this.buff.indexOf('\r\n') > -1) {
        // process.stdin.destroy();
        this.eventEmiter.emit('lineReaded', this.buff);
      }
    }
    var onEnd = function () {
      process.stdin.destroy();
    }
    process.stdin
      .on('data', onData)
      .on('end', onEnd);
    return this.eventEmiter;
  }
  destroy() {
    process.stdin.destroy();
  }
  pause() {
    process.stdin.pause();
  }
  getEventEmiter() {
    return this.eventEmiter;
  }
}

function formatConsoleDate(date: Date) {
  var hour = date.getHours();
  var minutes = date.getMinutes();
  var seconds = date.getSeconds();
  var milliseconds = date.getMilliseconds();

  return '\x1b[90m[AtomicReact][' +
    ((hour < 10) ? '0' + hour : hour) +
    ':' +
    ((minutes < 10) ? '0' + minutes : minutes) +
    ':' +
    ((seconds < 10) ? '0' + seconds : seconds) +
    // '.' +
    // ('00' + milliseconds).slice(-3) +
    ']\x1b[0m';
}

export const log = (obj: any, ...placeholders: any[]) => {
  placeholders.unshift(obj)
  placeholders.unshift(formatConsoleDate(new Date()))
  console.log.apply(this, placeholders)
}

export const error = (obj: string, ...placeholders: any[]) => {
  if (typeof obj === "string") obj = `\x1b[31m${obj}\x1b[0m`
  return log.apply(this, [obj, ...placeholders])
}
export const warn = (obj: string, ...placeholders: any[]) => {
  if (typeof obj === "string") obj = `\x1b[33m${obj}\x1b[0m`
  return log.apply(this, [obj, ...placeholders])
}
export const success = (obj: string, ...placeholders: any[]) => {
  if (typeof obj === "string") obj = `\x1b[32m${obj}\x1b[0m`
  return log.apply(this, [obj, ...placeholders])
}