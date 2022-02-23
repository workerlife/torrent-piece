/*! torrent-piece. MIT License. WebTorrent LLC <https://webtorrent.io/opensource> */
const BLOCK_LENGTH = 1 << 14

class Piece {
  constructor (length) {
    this.length = length
    this.missing = length
    this.sources = null

    this._chunks = Math.ceil(length / BLOCK_LENGTH)
    this._remainder = (length % BLOCK_LENGTH) || BLOCK_LENGTH
    this._buffered = 0
    this._buffer = null
    this._cancellations = null
    this._reservations = 0
    this._flushed = false
    this._quicks = null
  }

  chunkLength (i) {
    return i === this._chunks - 1 ? this._remainder : BLOCK_LENGTH
  }

  chunkLengthRemaining (i) {
    return this.length - (i * BLOCK_LENGTH)
  }

  chunkOffset (i) {
    return i * BLOCK_LENGTH
  }

  // 要下哪个 Block
  reserve () {
    if (!this.init()) return -1
    if (this._cancellations.length) return this._cancellations.pop()
    if (this._quicks.length) {
      for (let index = this._quicks.keys.length - 1; index >= 0; index--) {
        let key = this._quicks.keys[index]
        const element = this._quicks[key]
        let start = element[0]
        let end = element[1]
        let pos = element[2]
        if (pos > end) {
          continue
        }
        this._quicks[key] = [start, end, pos + 1]
        return pos
      }
    }
    
    if (this._quicks.has[this._reservations]) {
      while (this._reservations < this._chunks && this._quicks.has[this._reservations]) {
        this._reservations = this._quicks.has[this._reservations][2]
      }
      if ( this._reservations < this._chunks) {
        return this._reservations
      } 
    }
    
    if ( this._reservations < this._chunks) {
      return this._reservations++
    } 
    return -1
  }

  reserveRemaining () {
    if (!this.init()) return -1
    if (this._cancellations.length || this._reservations < this._chunks) {
      let min = this._reservations
      while (this._cancellations.length) {
        min = Math.min(min, this._cancellations.pop())
      }
      this._reservations = this._chunks
      return min
    }
    return -1
  }

  // 准备请求这个范围的Block
  _requestRange(start, end) {
    if (start > end) {
      return
    }
    if (this._quicks.has(start)) {
      return // 假设 start 和 end 一一对应
    }
    if (this._reservations > end) {
      return
    }
    if (this._reservations >= start) {
      this._quicks[start] = [start, end, this._reservations]
      return
    }
    this._quicks[start] = [start, end, start]
  }

  // 试图下载这个范围的数据，如果下载完了，返回true, 没完假。
  flushedRange(start, end) {
    if (this._flushed) {
      return true
    }
    if (this._quicks[start] === undefined) {
      this._requestRange(start, end)
      return flase
    }
    let element = this._quicks[start]
    return element[2] > element[1]
  }

  // 获取这个范围的数据
  flushRange(start, end) {
    if (this._flushed) {
      return null //此时应该从内存或磁盘读取
    }
    if (this.flushedRange(start, end) == false) {
      return null
    }
    if (this._quicks[start] === undefined) {
      this.requestRange(start, end)
      return flase
    }
    let element = this._quicks[start]
    return element[2] > element[1]
  }

  cancel (i) {
    if (!this.init()) return
    this._cancellations.push(i)
  }

  cancelRemaining (i) {
    if (!this.init()) return
    this._reservations = i
  }

  get (i) {
    if (!this.init()) return null
    return this._buffer[i]
  }

  set (i, data, source) {
    if (!this.init()) return false
    const len = data.length
    const blocks = Math.ceil(len / BLOCK_LENGTH)
    for (let j = 0; j < blocks; j++) {
      if (!this._buffer[i + j]) {
        const offset = j * BLOCK_LENGTH
        const splitData = data.slice(offset, offset + BLOCK_LENGTH)
        this._buffered++
        this._buffer[i + j] = splitData
        this.missing -= splitData.length
        if (!this.sources.includes(source)) {
          this.sources.push(source)
        }
      }
    }
    return this._buffered === this._chunks
  }

  flush () {
    if (!this._buffer || this._chunks !== this._buffered) return null
    const buffer = Buffer.concat(this._buffer, this.length)
    this._buffer = null
    this._cancellations = null
    this.sources = null
    this._flushed = true
    this._quicks = null
    return buffer
  }

  init () {
    if (this._flushed) return false
    if (this._buffer) return true
    this._buffer = new Array(this._chunks)
    this._cancellations = []
    this._quicks = new Map()
    this.sources = []
    return true
  }
}

Object.defineProperty(Piece, 'BLOCK_LENGTH', { value: BLOCK_LENGTH })

module.exports = Piece
