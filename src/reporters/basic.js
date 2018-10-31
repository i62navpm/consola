import util from 'util'
import { isPlainObject } from '../utils'
import { parseStack } from '../utils/error'
import { writeStream } from '../utils/stream'
import { formatDate } from '../utils/date'
import { leftAlign } from '../utils/string'

const DEFAULTS = {
  stream: process.stdout,
  errStream: process.stderr,
  dateFormat: 'HH:mm:ss'
}

export default class BasicReporter {
  constructor (options) {
    this.options = Object.assign({}, DEFAULTS, options)
  }

  write (data, { error, mode }) {
    return writeStream(
      data,
      error ? this.options.errStream : this.options.stream,
      mode
    )
  }

  formatStack (stack) {
    return ' at ' + parseStack(stack).join('\n at ')
  }

  formatArg (arg) {
    if (isPlainObject(arg)) {
      return JSON.stringify(arg, null, 2)
    }

    if (util.formatWithOptions) {
      // Node >= 10
      return util.formatWithOptions({ colors: true }, arg)
    } else {
      return util.format(arg)
    }
  }

  formatDate (date) {
    return formatDate(this.options.dateFormat, date)
  }

  getFields (logObj) {
    let message = logObj.message || ''
    let type = logObj.type || ''
    let tag = logObj.tag || ''
    let date = logObj.date || new Date()

    // Format args
    const args = logObj.args.map(arg => {
      // error-like argument
      if (arg.stack) {
        if (!message.length && arg.message) {
          message = arg.message
        }
        if (!type.length) {
          type = 'error'
        }
        if (!tag.length && arg.code) {
          tag = arg.code
        }
        return this.formatStack(arg.stack)
      }

      // General argument
      return this.formatArg(arg)
    })

    // If no message is provided, assume args[0] as message
    if (!message.length && args.length) {
      message = args.shift()
    }

    // Concert other args to additional
    const additional = args.join('\n')

    return {
      additional,
      date,
      message,
      tag,
      type
    }
  }

  formatLogObj (logObj) {
    const fields = this.getFields(logObj)

    const date = this.formatDate(fields.date)

    const type = leftAlign(fields.type.toUpperCase(), 7)

    return [
      `[${date}]`,
      `[${fields.tag}]`,
      `[${type}]`,
      `${fields.message}`,
      `${fields.additional}`
    ]
  }

  log (logObj, { async = false } = {}) {
    const line = this.formatLogObj(logObj)
      .filter(x => x && x.length && x !== '[]')
      .join(' ') + '\n'

    return this.write(line, {
      error: logObj.error,
      mode: async ? 'async' : 'default'
    })
  }
}
