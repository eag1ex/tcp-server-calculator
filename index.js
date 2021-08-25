const net = require('net')

/**
 * @typedef {net.Socket} Client
 * @typedef {net.AddressInfo} AddressInfo
 * @typedef {{[id:string]:Array<{timestamp:number,data:string}>}} Store
 *
 */

/**
 * Safety check, make sure we only deal with operators and numbers
 * @param {string} str
 * @param {boolean?} noError
 * @returns {any}
 */
const safeEval = function (str, noError = true) {
    const numberSize = (str.match(/[+-/%]/g) || []).length
    const operatorSize = (str.match(/[0-9]/g) || []).length
    // total of operator and number strings should match initial str
    if (numberSize + operatorSize !== (str || '').length) {
        if (noError) return false
        else throw 'Eval error'
    }

    try {
        return new Function(`return ${str};`)()
    } catch (err) {
        // if test was valid, but next input was not complete
        if (noError) return false
        else throw 'Eval error'
    }
}

const messages = {
    get errors() {
        let pre = 'error'
        return {
            DIVISION: `${pre}: division by zero`,
            MODULO: `${pre}: modulo by zero`,
            DIVISION_MODULO: `${pre}: division, or modulo by zero`,
            SYNTAX: `${pre}: incorrect syntax`,
        }
    },
    get notice() {
        let pre = 'notice'
        return {
            ADDED: `${pre}: concat`,
        }
    },
}

/**
 * Collect information about the client, store each receiving packet with timestamp, id, and receiving data
 * - when value is fulfilled or returns an error, client stored data is deleted
 * - packet re/evaluates each input when not fulfilled
 */
class ServerStore {
    /**
     * @type {Store}
     */
    store = {}

    constructor() {}

    /**
     * @param {AddressInfo} addressInfo
     * @returns {string} uniq client id
     */
    uid(addressInfo) {
        // NOTE we may use other means when token is available...
        return [addressInfo.address, addressInfo.family, addressInfo.port]
            .filter((n) => !!n)
            .map((n, i, all) => (i < all.length - 1 ? n + '+' : n))
            .toString()
            .replace(/,/g, '')
    }

    /**
     * @param {string} uid
     * @param {any} buffer
     * @param {((str:string, nextStr?:string,concatStr?:string,inx?:number, size?:number )=>({message?:string,done?:string,next?:boolean}))?} evaluateCB
     * @param {((error:string)=>any)?} errCB each error will prune current uid/clientLot
     * @returns {{error?:any, result?:string,message?:string}} returns concat result or error
     */
    packet(uid, buffer, evaluateCB = undefined, errCB = undefined) {
        console.log('[packet/uid]', uid)
        if (!this.store[uid]) this.store[uid] = []

        this.store[uid].push({ timestamp: new Date().getTime(), data: this.newLine(buffer) })

        let lot = ''
        let message = ''
        let error

        if (typeof evaluateCB === 'function') {
            // performing each lot test by Calculator/validators
            // stop process at error
            // keep adding until result or error
            const copyStore = JSON.parse(JSON.stringify(this.store[uid]))
            for (let inx = 0; inx < copyStore.length; inx++) {
                let str = copyStore[inx].data
                let futureLot = (copyStore[inx + 1] || {}).data
                lot = lot + str

                //console.log('[packet/lot]', lot)
               // console.log(' ')

                try {
                    // evaluate every time new input is received
                    /** @type {{message?:string,done?:string,next?:boolean}} */
                    let resultFound = evaluateCB.apply(this, [str, futureLot, lot, inx, copyStore.length])

                    // evaluation pass, do next
                    if (resultFound.next) {
                        continue
                    }

                    // result done, do next thing
                    if (resultFound.done) {
                        lot = resultFound.done
                        break
                    }

                    // provide message in incomplete result
                    if (resultFound.message) {
                        message = resultFound.message
                        break
                    }
                } catch (err) {
                    error = err.toString()
                    if (typeof errCB === 'function') errCB.apply(this, [error])

                    // delete uid collected data due to error, start over again for this uid
                    delete this.store[uid]
                    break
                }
            }
        }

        if (message) return { message }
        if (error) return { error }
        else {
            // remove on done
            delete this.store[uid]
            return { result: lot }
        }
    }

    /**
     * Clean text input after `\r\n`
     * @param {any} buffered
     * @returns {string}
     */
    newLine(buffered) {
        const result = buffered.toString('utf-8')
        return result.trim().replace(/\r/, '').replace(/\n/, '')
    }
}

class Calculator {
    constructor() {}

    /**
     *
     * @param {string} input initial input
     * @returns {any} can return calculated data, or error message
     */
    $result(input) {
        try {
            if (!input) return messages.errors.SYNTAX

            // if (!this.validInput(input)) {
            //     console.log(messages.errors.SYNTAX, `(11) input: ${input}`)
            //     return messages.errors.SYNTAX
            // }

            if (this.operatorsCount(input) !== 1) {
                console.log(messages.errors.SYNTAX, `(12) input: ${input}`)
                return messages.errors.SYNTAX
            }
            // get <number><operator><number>
            const inputData = this.separate(input)
            if (!inputData) {
                console.log(messages.errors.SYNTAX, `(13) input: ${input}`)
                return messages.errors.SYNTAX
            }

            if (inputData.numL === undefined || inputData.numR === undefined || inputData.operator === undefined) {
                console.log(messages.errors.SYNTAX, `(14) input: ${input}`)
                return messages.errors.SYNTAX
            }

            // REVIEW why should 0.1+0.2 be an error? Unclear regarding the brief around "Rounding"
            if (Math.round(inputData.numL) === 0 && Math.round(inputData.numR) === 0) {
                console.log(messages.errors.SYNTAX, `(15) input: ${input}`)
                return messages.errors.SYNTAX
            }

            if (this.divisionNearZero(inputData.operator, inputData.numR)) {
                console.log(messages.errors.DIVISION, `(16) input: ${input}`)
                return messages.errors.DIVISION
            }

            if (this.divisionModuloByZero(inputData.operator, inputData.numR)) {
                console.log(messages.errors.DIVISION_MODULO, `(17) input: ${input}`)
                return messages.errors.DIVISION_MODULO
            }

            let sum
            try {
                sum = safeEval(`${inputData.numL}${inputData.operator}${inputData.numR}`, false)
            } catch (err) {
                console.log(messages.errors.SYNTAX, `(18) input: ${input}`)
                return messages.errors.SYNTAX
            }

            //----------------------------------
            // safety to always return positive integer
            return this.unsigned32BitValue(sum)
        } catch (err) {
            console.log(messages.errors.SYNTAX, `(19) input: ${input}`)
            return messages.errors.SYNTAX
        }
    }

    /**
     * Before concatenating inputs check if it can be combined
     * @param {string} numLMixed
     * @param {string} numRMixed
     * @returns {boolean}
     */
    canValuesCombine(numLMixed, numRMixed) {
        // {number}{operator}
        const l = this.operators.filter((n) => numLMixed[numLMixed.length - 1].includes(n)).length === 1
        // {operator} {number}
        const r = this.operators.filter((n) => numRMixed[0].includes(n)).length === 1
        return l || r
    }

    /**
     * check if right hand number is near zero with / division operator
     * @param {string} operator
     * @param {number} numR
     * @returns {boolean}
     */
    divisionNearZero(operator, numR) {
        return operator === '/' && Math.round(numR) === 0
    }

    /**
     * check if right hand number is zero with /% operators
     * @param {string} operator
     * @param {number} numR
     * @returns {boolean}
     */
    divisionModuloByZero(operator, numR) {
        return ['/', '%'].indexOf(operator) !== -1 && numR <= 0
    }

    /**
     * Check how many operators were found in the input
     *  @param {string} input
     * @returns {number}
     */
    operatorsCount(input) {
        return !input ? 0 : this.operators.filter((n) => input.indexOf(n) !== -1).length
    }

    /**
     * Check how many numbers were found in the mixed input
     *  @param {string} input
     * @returns {number}
     */
    includeNumbers(input) {
        return input.replace(/[+-/%]/g, '').split('').length
    }

    /**
     * separate input, example: 10+20 to numL+numR
     * @param {string} input
     * @returns {{numL:number,operator:string,numR:number}}
     */
    separate(input) {
        /** @type {{numL:number,operator:string,numR:number}} */
        let o
        for (let inx = 0; inx < this.operators.length; inx++) {
            let spArr = input.split(this.operators[inx])
            // operator was found once and between
            if (input.indexOf(this.operators[inx]) !== -1 && spArr.length === 2) {
                o = {
                    numL: spArr[0] ? Number(spArr[0]) : undefined,
                    operator: this.operators[inx],
                    numR: spArr[1] ? Number(spArr[1]) : undefined,
                }
                break
            }
        }
        return o
    }

    /**
     * Test if we have operator first then number <operator><number>
     *
     * @param {string} input
     * @returns {boolean}
     */
    operatorFollowedByNumber(input) {
        return this.operators.filter((n) => input[0].includes(n)).length === 1
    }

    /**
     * Test if input is only an <operator>
     * @param {string} input
     * @returns {boolean}
     */
    onlyOperator(input) {
        return this.operators.filter((n) => input.includes(n)).length === input.length
    }

    /**
     * Test if we have number first then operator <number><operator>
     *
     * @param {string} input
     * @returns {boolean}
     */
    numberFollowedByOperator(input) {
        return this.operators.filter((n) => input[input.length - 1].includes(n)).length === 1
    }

    /**
     * Test if we have only a number <number>
     *
     * @param {string} input
     * @returns {boolean}
     */
    numberNoOperator(input) {
        return this.operators.filter((n) => input.includes(n)).length === 0
    }
    /**
     * Test if input is valid, we only accept numbers and math operators, excluding: =/s
     * @param {string} input
     * @returns {boolean}
     */
    validInput(input) {
        return /^[0-9+-/%*]+$/g.test(input)
    }

    /**
     * Perform test on each string to see conditions are met, example:
     *  /{operator}{number}/,/{number}{operator}/,/{operator}{number}{operator}/
     * @param {*} str
     * @returns {boolean}
     */
    operatorToNumberJoinValidation(str) {
        /**
         * @type {Array<{[name:string]:{r$:RegExp, val:number}}>}
         */
        let allowedOpRexp = [
            // addition and subtracting
            { '+x-': { r$: /^\+[0-9]\-*$/g, val: 3 } },
            { '+x+': { r$: /^\+[0-9]\+*$/g, val: 3 } },
            { '-x-': { r$: /^\-[0-9]\-*$/g, val: 3 } },
            { '-x+': { r$: /^\-[0-9]\+*$/g, val: 3 } },
            { '-x': { r$: /^\-[0-9]*$/g, val: 2 } },
            { 'x-': { r$: /^[0-9]-*$/g, val: 2 } },
            { '+x': { r$: /^\+[0-9]*$/g, val: 2 } },
            { 'x+': { r$: /^[0-9]\+*$/g, val: 2 } },
            { '+x': { r$: /^\+[0-9]*$/g, val: 2 } },
            // divisions both or either side
            { '/x/': { r$: /^\/[0-9]\/\/*$/g, val: 3 } },
            { '/x': { r$: /^\/[0-9]*$/g, val: 2 } },
            { 'x/': { r$: /^[0-9]\/\/*$/g, val: 2 } },

            // multiply both or either side
            { '*x': { r$: /^\*[0-9]*$/g, val: 2 } },
            { 'x*': { r$: /^[0-9]*\*$/g, val: 2 } },
            { '*x*': { r$: /^\*[0-9]*\*$/g, val: 2 } },
            // module both or either side
            { '%x%': { r$: /^\%[0-9]%*$/g, val: 3 } },
            { 'x%': { r$: /^[0-9]%*$/g, val: 2 } },
            { '%x': { r$: /^\%[0-9]*$/g, val: 2 } },
        ]

        /**
         *
         * @param {string} str
         * @param {RegExp} r$
         * @param {number} val
         */
        const test = (str = '', r$, val) => {
            let o =
                (str.match(r$) || [])
                    .filter((n) => !!n)
                    .toString()
                    .split('').length === val
            return o
        }

        let pass = false
        for (let item of allowedOpRexp) {
            let key = Object.keys(item)[0]
            let exp = item[key]

            if (test(str, exp.r$, exp.val)) {
                pass = true
                break
            }
        }
        return pass
    }

    /**
     * Check operator patter, <operator><operator>
     * @param {string} input
     * @returns {boolean}
     */
    operatorAfterAnother(input) {
        let valid = false
        let bits = input.split('')
        for (let inx = 0; inx < bits.length; inx++) {
            let next = bits[inx + 1]
            if (next && !valid) {
                if (bits[inx].match(/[+-/%*]/g) && bits[inx + 1].match(/[+-/%*]/g)) {
                    valid = true
                    break
                }
            }
        }
        return valid
    }

    /**
     * When we have {number}{operator}{number} ready to return result at initial phase
     * @param {string} input
     * @returns {boolean}
     */
    fullInputSequence(input) {
        let ab = input.split(/[+-/%]/g).filter((n) => !!n)
        return ab.length < input.length && ab.length > 1
    }

    /**
     * Each newline can include {operator}{number}{operator},{operator}{number}, or {number}{operator}
     * @param {string} input
     * @returns {boolean}
     */
    joinTest(input) {
        // if no operators we only have a number
        if (!input.match(/[+-/%*]/g)) return true
        // test if input is valid
        else return this.operatorToNumberJoinValidation(input)
    }

    /**
     * We only accept unsigned 32 bit integers, so only return those values
     * @param {number} num
     * @returns {number}
     */
    unsigned32BitValue(num) {
        return num >>> 0
    }

    get operators() {
        return ['-', '+', '/', '*', '%']
    }
}

/**
 * Start our net server
 */
function START_SERVER() {
    const store = new ServerStore()
    const calc = new Calculator()

    const PORT = 1010
    const server = net
        .createServer(function (client) {
            client
                .setEncoding('utf-8')
                .setTimeout(1000)

                // When receive client data.
                .on('data', async function (data) {
                    let buffered = ''

                    // @ts-ignore
                    const uid = store.uid(client.address())
                    for await (const chunk of data) buffered += chunk

                    console.log('server bytesWritten:', client.bytesWritten)

                    /**
                     *  each input gets evaluated over again for the same client session
                     * initial evaluation allows to validate more depth,
                     * for example: we can keep adding values if safeEval doesnt fail
                     *
                     */
                    let pocketResult = store.packet(
                        uid,
                        buffered,
                        (str, strNext, concatStr, inx, size) => {
                            if (!calc.validInput(str)) {
                                console.log(messages.errors.SYNTAX, `(1) input: ${concatStr}`)
                                throw messages.errors.SYNTAX
                            }

                            //------------------
                            // done at first input
                            if (calc.fullInputSequence(str)) {
                                let done = safeEval(concatStr, true)
                                if (done !== false) return { done: concatStr }
                            }

                            // only test if 1 number is present
                            if (calc.includeNumbers(str) == 1) {
                                if (!calc.joinTest(str)) {
                                    console.log(messages.errors.SYNTAX, `(3) input: ${concatStr}`)
                                    throw messages.errors.SYNTAX
                                }
                            }

                            if (!calc.numberNoOperator(str)) {
                                if (calc.operatorAfterAnother(str)) {
                                    console.log(messages.errors.SYNTAX, `(5) input: ${concatStr}`)
                                    throw messages.errors.SYNTAX
                                }
                            }

                            if (calc.onlyOperator(str)) {
                                console.log(messages.errors.SYNTAX, `(6) input: ${concatStr}`)
                                throw messages.errors.SYNTAX
                            }

                            // first input <operator><number> to be invalid
                            if (calc.operatorFollowedByNumber(str) && size === 1 && inx === 0) {
                                console.log(messages.errors.SYNTAX, `(7) input: ${concatStr}`)
                                throw messages.errors.SYNTAX
                            }

                            // at the end/ still continue  ...<operator><number><operator>
                            if (calc.numberFollowedByOperator(str) && size - 1 === inx) {
                                return { message: messages.notice.ADDED + ` ${concatStr}` }
                            }

                            // first input without <operator> skip validation
                            if (calc.operatorsCount(str) === 0 && size === 1) {
                                return { message: messages.notice.ADDED + ` ${concatStr}` }
                            }

                            // if no {operator} present for the next input
                            if (!calc.operatorsCount(str) && !calc.operatorsCount(strNext) && size > 1 && size - 1 !== inx) {
                                console.log(inx, size, str, strNext)
                                console.log(messages.errors.SYNTAX, `(8) input: ${concatStr}`)
                                throw messages.errors.SYNTAX
                            }

                            if (str && strNext !== undefined) {
                                if (!calc.canValuesCombine(str, strNext)) {
                                    console.log(messages.errors.SYNTAX, `(9) input: ${concatStr}`)
                                    throw messages.errors.SYNTAX
                                }
                            }

                            // test if values can be added together before next > Calculator
                            let done = safeEval(concatStr, true)
                            if (inx < size - 1) return { next: true }

                            if (done === false) {
                                console.log(messages.errors.SYNTAX, `(10) input: ${concatStr}`, str)
                                throw messages.errors.SYNTAX
                            } else {
                                return { done: concatStr }
                            }
                        },
                        (err) => {
                            let msg = err.toString()
                            console.error('client output:', msg, ` bytes: ${client.bytesRead}`)
                            client.end(msg + ', [reset]')
                        }
                    ) // end of callback

                    if (pocketResult.message) {
                        // Print message to server
                        console.log('client output:', pocketResult.message, ` bytes: ${client.bytesRead}`)
                        console.log(' ')

                        // Send and print result to client
                        client.end(pocketResult.message + '')
                    }

                    // once result is available we can apply to our calculator
                    if (pocketResult.result) {
                        const output = calc.$result(pocketResult.result)

                        // Print message to server

                        console.log('server result:', pocketResult.result, ` bytes: ${client.bytesRead}`)
                        console.log('client output:', output)
                        console.log(' ')

                        // Send and print result to client
                        client.end(output + '')
                    }
                })
                .on('error', function (err) {
                    console.error('[client][error]', JSON.stringify(err))
                })
        })
        .listen(PORT, function () {
            let info = JSON.stringify(server.address())
            console.log('TCP listen on : ' + info)
            server
                .on('close', function () {
                    console.log('TCP is closed')
                })
                .on('error', function (err) {
                    console.log('[server][error]', JSON.stringify(err))
                })
        })
    return server
}
module.exports = START_SERVER()
