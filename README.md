Center identity makes it easy for developers to manager their users without losing control.

#Build
`export NODE_OPTIONS=--openssl-legacy-provider`
`eval $(ssh-agent)`
`ssh-add ssh/private_key`
Issue this command:
`webpack`

#Usage
```
var ci = new CenterIdentity();

// create relationship aka register your new user
ci.addUser();
```