# PigeonLab Engineering Test

## Overview

Your task is to create a TCP based calculator service and deploy it. It'll take 
in simple math operations such as `1+1`, or `5*10` and reply with the answer.

You should implement the server in node.js, with no dependancies, and in a single
js file. Include any automated tests in the same file.

## Input / Output

The server should accept input over TCP on a port of your choosing. Input is text
based with each command followed by a newline character. Responses are also given
as text followed by a newline.

For a given connection, the output should have one line of output per line of
input. (Don't send human friendly messages on the socket.)

Note that TCP connections are streams of bytes, and one 'data' event does not
correspond to one line of input. **Your input lines might be split or merged
arbitrarily.** Note that many examples of TCP servers that you might find on google
do not handle this correctly. It's particularly important to get this right because
our testing script relies on it.

## Semantics

Each command should have the syntax `<number><operator><number>`. 

Where:

 * `number` is a decimal representation of an unsigned 32 bit integer.
 * `operator` is one of `+`, `-`, `*`, `/`, `%`.

When an invalid command is recieved, the response should be an error. Commands
with extra whitespace are invalid.

Math operations should be evaluated according to the semantics of **unsigned 32 bit
numbers**. For example, the result of `4294967295+1` is `0`. Rounding for
division is towards zero. Division or modulo by zero should generate an error.

Errors should be represented like `error: <human readable message>`. Errors take
up one line, just like normal responses. After an error, the server should process
the next line as normal.

### Example Input

```
1+1
10*5
101/10
99%10
0-1
0/0
0.1+0.2
1 + 1
hello world
```

### Example Output

```
2
50
10
9
4294967295
error: division by zero
error: incorrect syntax
error: incorrect syntax
error: incorrect syntax
```

## Submission

Create a secret gist on https://gist.github.com and email us the link.

Please don't make your code public.

