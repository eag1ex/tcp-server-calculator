

## TCP-server-calculator
Simple Node.js calculator handling 32bit unsigned integers using npm/net module to communicate with server via TCP connection, and send signal inputs via CLI and netcat on port 1010

- Features:
    - User session by client address/uid
    - Always producing positive results, including zero

### Example
```sh
# Using netcat to produce results
$/ echo 1/12 | nc localhost 1010 # should echo back with calculated result
``` 


### Start
To start the server just run:

```sh
/$ node index # or /$ npm star

```

### Stack
Nodejs, net/sockets, client session



### How to interact
Assume we are using netcat with the command `$/ echo {input} | nc localhost 1010`

- Way to understand operations is `<number><operator><number>`, when concatenating... Operators can add before or after the `<number>`, where initial input always starts with `<number>`
- Incomplete sequence kept concatenating, and held in memory, unless incorrect value entered _(session is cleared)_
- Successfully sequence handles `<number><operator><number>`, but before values are evaluated, you can keep concatenating.

```sh
# example 1
20 # concat value with notice output
-10 # produce: 10

# example 2
0.9- # concat ...
0.1 # produce unsigned integer value: 0

# example 3
10* # concat ...
5 # produce: 50

# example 4
0-1 # produce unsigned integer: 4294967295

# example 5
101 # concat ...
/10 # produce: 10 


# example 6, no division by 0 allowed
0/0 # produce: error

# example 7, numbers must round above 0
0.1+ # concat ...
0.2 # produce: error


# example 8, no spaces allowed
1 + 1 # produce: error

# example 9, no alpha chars allowed
hello world # produce: error

# example 10, no division by 0 allowed
2 # concat ...
/0 # produce: error


# example 11, no modulo by 0 allowed
3 # concat ...
%0 # produce: error

# example 12, no more then <number><operator><number> allowed
3 # concat ...
+3+ # concat ...
5 # produce: error

```




