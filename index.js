const net = require('net')

class Calculator {
    constructor() {}

    /**
     *
     * @param {string} input initial input
     * @returns {any} can return calculated data, or error message
     */
    $result(input) {
        try {
            if (!input) return this.errors.SYNTAX

            if (!this.validInput(input)) {
                console.log(this.errors.SYNTAX, `(1) input: ${input}`)
                return this.errors.SYNTAX
            }

            if (!this.includesOperator(input)) {
                console.log(this.errors.SYNTAX, `(2) input: ${input}`)
                return this.errors.SYNTAX
            }
            // get <number><operator><number>
            const inputData = this.separate(input)
            if (!inputData) {
                console.log(this.errors.SYNTAX, `(3) input: ${input}`)
                return this.errors.SYNTAX
            }

            if (inputData.numL === undefined || inputData.numR === undefined || inputData.operator === undefined) {
                console.log(this.errors.SYNTAX, `(4) input: ${input}`)
                return this.errors.SYNTAX
            }

            // REVIEW why should 0.1+0.2 be an error? Unclear regarding the brief around "Rounding"
            if(Math.round(inputData.numL) ===0 && Math.round(inputData.numR) ===0){
                console.log(this.errors.SYNTAX, `(5) input: ${input}`)
                return this.errors.SYNTAX
            }

            if (this.divisionNearZero(inputData.operator,inputData.numR)) {
                console.log(this.errors.DIVISION, `(6) input: ${input}`)
                return this.errors.DIVISION
            }

            if (this.divisionModuloByZero(inputData.operator,inputData.numR)) {
                console.log(this.errors.DIVISION_MODULO, `(7) input: ${input}`)
                return this.errors.DIVISION_MODULO
            }
            

            // perform our calculation
            const sum = this.calc(inputData.numL, inputData.operator, inputData.numR)
            if (sum === undefined) {
                console.log(this.errors.SYNTAX, `(8) input: ${input}`)
                return this.errors.SYNTAX
            }

            //----------------------------------
            // safety to always return positive integer
            return this.unsigned32BitValue(sum)
        } catch (err) {
            console.log(this.errors.SYNTAX, `(9) input: ${input}`)
            return this.errors.SYNTAX
        }
    }

    /**
     * Clean string from next line chars
     * @param {any} buffered
     * @returns {string}
     */
    sanatizedInput(buffered) {
        const result = buffered.toString('utf-8')
        return result.trim().split('').toString().replace(/,/g, '').replace(/\r/, '').replace(/\n/, '')
    }

    /**
     * check if right hand number is near zero with / division operator
     * @param {string} operator 
     * @param {number} numR 
     * @returns {boolean}
     */
    divisionNearZero(operator,numR){
        if(operator==='/' && Math.round(numR) ===0) return true
        else return false
    }

    /**
     * check if right hand number is zero with /% operators
     * @param {string} operator 
     * @param {number} numR 
     * @returns {boolean}
     */
    divisionModuloByZero(operator,numR){
        if(['/','%'].indexOf(operator)!==-1 && numR<=0) return true
        else return false
    }

   

    /**
     * Calculate results
     * @param {number} numL
     * @param {string} operator
     * @param {number} numR
     * @returns {number}
     */
    calc(numL, operator, numR) {
        /** @type {number} */
        let sum
        switch (operator) {
            case '-':
                sum = numL - numR
                break
            case '+':
                sum = numL + numR
                break
            case '/':
                sum = numL / numR
                break
            case '%':
                sum = numL % numR
                break
            case '*':
                sum = numL * numR
                break
            default:
                console.log(`invalid operator: ${operator}`)
        }
        return sum
    }

    /**
     * Input must include 1 operator
     * @param {string} input
     */
    includesOperator(input) {
        return this.operators.filter((n) => input.indexOf(n) !== -1).length === 1
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
     * Test if input is valid, we only accept numbers and math operators, excluding: =/s
     * @param {string} input
     * @returns {boolean}
     */
    validInput(input) {
        const regex = /^[0-9+-/%*]+$/g
        return regex.test(input)
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

    get errors() {
        let pre = 'error'
        return {
            DIVISION: `${pre}: division by zero`,
            MODULO: `${pre}: modulo by zero`,
            DIVISION_MODULO: `${pre}: division, or modulo by zero`,
            SYNTAX: `${pre}: incorrect syntax`,
        }
    }
}

const calc = new Calculator()


/**
 * Start our net server
 */
function START_SERVER() {
    const PORT = 1010
    const server = net
        .createServer(function (client) {
            client.setEncoding('utf-8').setTimeout(1000)

            // When receive client data.
            client.on('data', async function (data) {
                let buffered = ''
                for await (const chunk of data) buffered += chunk

                const clean = calc.sanatizedInput(buffered)
                console.log(`client input: ${clean}`, ' bytesWritten: ', client.bytesWritten)
                console.log(' ')

                const output = calc.$result(clean)

                // Print message to server
                console.log('client output:', output, ` bytes: ${client.bytesRead}`)

                // Send and print result to client
                client.end(output + '')
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
                    console.log(JSON.stringify(err))
                })
        })
}
START_SERVER()
