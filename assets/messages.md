Hi Mike,

To answer your questions, let me summarise into several points,

1. Each command will always end with a newline. Regardless of how many data chunks arrive on the receiving end.
2. The command can be joined, separate or sent in multiple chunks but they will always arrive in order.
3. The stream is not continuous and there might be delay in chunks arriving on the receiving end.
4. Client expects to receive only 1 response for each command sent.
5. Assume that the client will disconnect once it receives all the responses for each command it sends.
6. Server stream should always be open for the client to connect to.

In the example \n1+1\n\n, this will be 3 separate commands, "\n","1+1\n","\n". And the response will be syntax error, 2 and syntax error.

Hope that helps and clarifies your questions.

Cheers,
Hadi