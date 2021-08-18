

### TCP-server-calculator
This is a simple Node.js calculator handling 32bit unsigned integers using npm/net module to communicate with client via TCP connection, and send signal inputs via CLI on port 1010 with simple commands:

```sh
# Using netcat to produce results
$/ echo 1/12 | nc localhost 1010 # should echo back with calculated result

``` 


### Example Input
Provide each input via netcat/nc: `$/echo {input} | nc localhost 1010`

```sh 
1+1
10*5
101/10
99%10
0-1 # 
0/0 # error
0.1+0.2 # error, numbers must round above 0
1 + 1 # error
hello world # error
2/0 # error 
3%0 # error
```

### Example Output

```sh
2
50
10
9
4294967295
error: division by zero
error: incorrect syntax
error: incorrect syntax
error: incorrect syntax
error: division by zero
error: division, or modulo by zero
```



