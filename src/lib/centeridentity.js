import forge from 'node-forge';
import { ec } from 'elliptic';
import base64 from 'base64-js';
import X25519 from 'js-x25519';
import wif from 'wif';
import { base58_to_binary, binary_to_base58 } from 'base58-js'


export default class CenterIdentity {
    constructor(kwargs) {
        const {api_key, url_prefix, use_local_storage, strength, selfGenerateTransaction} = kwargs;
        switch(strength) {
            case 'low':
                this.strength = 0x0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
                break;
            case 'medium':
                this.strength = 0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
                break;
            case 'high':
                this.strength = 0x000000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
                break;
            default:
                this.strength = 0x0000ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
                break;
        }
        this.api_key = api_key;
        this.url_prefix = url_prefix || 'https://centeridentity.com';
        this.use_local_storage = use_local_storage || false;
        this.friends_list_wif = 'Kx5or1SpDjQRy2gFwUpkGtxVZaM9tASYpozkb33TErm2PDBx38nJ';
        this.origin = window && window.location ? 'origin=' + encodeURIComponent(window.location.origin) : '';
        this.selfGenerateTransaction = selfGenerateTransaction || false;
    }

    async createRelationship(me, user, extra_data) {
        let relationship = {
            their_username: user.username,
            their_username_signature: user.username_signature,
            their_public_key: user.public_key,
            my_username: me.username,
            my_username_signature: me.username_signature,
            my_public_key: me.public_key
        }
        Object.assign(relationship, extra_data);
        user.relationship = relationship;
        return user;
    }

    async createRelationshipTransaction(me, user, group, extra_data) {
        var join = await this.createRelationship(me, user, extra_data);
        var dh_keys = this.get_dh_keys(me, user);
        join.relationship.dh_private_key = dh_keys.dh_private_key
        var encryptedRelationship = await this.encrypt(me.wif, JSON.stringify(join.relationship));
        var meObject = this.toObject(me)
        var requested_rid = null;
        var requester_rid = null;
        if (group) {
            requested_rid = this.generate_rid(
                group,
                user,
            )
            requester_rid = this.generate_rid(
                group,
                me,
            )
        }
        return await this.generateTransaction(
            me,
            meObject.public_key,
            dh_keys.dh_public_key,
            this.generate_rid(me, user),
            encryptedRelationship,
            0,
            requester_rid,
            requested_rid
        );
    }

    async approveRelationshipTransaction(me, user, request) {
        var join = await this.createRelationship(me, user);
        var dh_keys = this.get_dh_keys(me, user);
        join.relationship.dh_private_key = dh_keys.dh_private_key
        var encryptedRelationship = await this.encrypt(me.wif, JSON.stringify(join.relationship));
        var meObject = this.toObject(me)
        var requested_rid = request.requested_rid;
        var requester_rid = request.requester_rid;
        return await this.generateTransaction(
            me,
            meObject.public_key,
            dh_keys.dh_public_key,
            this.generate_rid(me, user),
            encryptedRelationship,
            0,
            requester_rid,
            requested_rid
        );
    }

    async createRelationshipFromNew(me, name, extra_data) {
        let user = await this.createUser(name);
        let relationship = {
            their_username: user.username,
            their_username_signature: user.username_signature,
            their_public_key: user.public_key,
            their_wif: user.wif,
            my_username: me.username,
            my_username_signature: me.username_signature,
            my_public_key: me.public_key
        }
        Object.assign(relationship, extra_data);
        user.relationship = relationship;
        return user;
    }

    async set(user, latitude, longitude) {
        return new Promise(function(resolve, reject){
            this.user = user;
            this.longitude = longitude;
            this.latitude = latitude;
            return resolve();
        }.bind(this))
        .then(function(){
            return this.getLocation();
        }.bind(this))
        .then(function(position){
            return this.showPosition(this.user.username, position);
        }.bind(this))
        .then(function(position){
            return this.generateRecovery()
        }.bind(this))
        .then(function(position){
            return this.encryptSeed();
        }.bind(this))
        .then(function(encryptedSeed){
          return new Promise(async function(resolve, reject){
            if (this.selfGenerateTransaction) {
              var centerIdentityUser = {
                public_key: '02a9aed3a4d69013246d24e25ded69855fbd590cb75b4a90fbfdc337111681feba',
                address: '1EWkrpUezWMpByE6nys6VXubjFLorgbZuP',
                username: '',
                username_signature: 'MEQCIC7ADPLI3VPDNpQPaXAeB8gUk2LrvZDJIdEg9C12dj5PAiB61Te/sen1D++EJAcgnGLH4iq7HTZHv/FNByuvu4PrrA=='
              }
              const public_user = this.toObject(this.user);
              var join = await this.createRelationship(public_user, centerIdentityUser);
              var dh_keys = this.get_dh_keys(public_user, centerIdentityUser);
              join.relationship.dh_private_key = dh_keys.dh_private_key
              var encryptedRelationship = await this.encrypt(this.user.wif, JSON.stringify(join.relationship));

              const friendTxn = await this.generateTransaction(
                this.user,
                this.user.public_key,
                dh_keys.dh_public_key,
                this.generate_rid(public_user, centerIdentityUser),
                encryptedRelationship,
                0,
                '',
                ''
              )
              const buryTxn = await this.generateTransaction(
                this.user,
                this.user.public_key,
                '',
                this.rid,
                encryptedSeed,
                0,
                '',
                ''
              )
              resolve([friendTxn, buryTxn])
            } else {
              var payload =  `{
                  "rid": "` + this.rid + `",
                  "relationship": "` + encryptedSeed + `"
              }`;
              return fetch(this.url_prefix + '/bury', {
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  method: 'POST',
                  body: payload,
              })
              .then(async (res) => {
                  const data = await res.json();
                  return resolve(data);
              })
              .catch((err) => {
                  return reject(err);
              })
            }
          }.bind(this));
        }.bind(this))
        .catch(function(err) {
            console.log(err)
        }.bind(this));
    }

    async setFromNew(username, latitude, longitude) {
        this.username = username;
        this.latitude = latitude;
        this.longitude = longitude;
        return this.createUser(username)
        .then(function(user) {
            this.user = user;
            return this.set(
                this.user,
                this.latitude,
                this.longitude
            )
        }.bind(this))
        .then(function() {
            return new Promise(function(resolve, reject) {
                return resolve(this.user);
            }.bind(this));
        }.bind(this))
        .catch(function(err) {
            console.log(err)
        }.bind(this));
    }

    async get(username, latitude, longitude) {
        return new Promise(function(resolve, reject){
            this.longitude = longitude;
            this.latitude = latitude;
            return resolve();
        }.bind(this))
        .then(function(){
            return this.getLocation();
        }.bind(this))
        .then(function(position){
            return this.showPosition(username, position);
        }.bind(this))
        .then(function(){
            return this.generateRecovery();
        }.bind(this))
        .then(function(position){
            return this.decryptSeed();
        }.bind(this))
        .then(async function(wif){
            return await this.reviveUser(wif, username);
        }.bind(this));
    }

    async getLocation() {
        return new Promise(function(resolve, reject){
            if (typeof navigator !== 'undefined' && navigator.geolocation && !(this.longitude && this.latitude)) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    return resolve(position);
                });
            } else {
                return resolve({
                    coords: {
                        longitude: parseFloat(this.longitude),
                        latitude: parseFloat(this.latitude)
                    }
                })
            }
        }.bind(this));
    }

    async showPosition(username, position) {
        return new Promise(function(resolve, reject){
            var lat = position.coords.latitude.toFixed(5);
            var long = position.coords.longitude.toFixed(5);
            this.header = long + (lat + username);
            return resolve();
        }.bind(this));
    }

    async generateRecovery() {
        this.symmetric_key = '';
        this.rid = '';
        return new Promise(function(resolve, reject){
            for(var i=0; i === i; i++) {
                this.header = forge.sha256.create().update(this.header).digest().toHex();
                if (parseInt(this.header, 16) < this.strength && this.symmetric_key) {
                    this.header = forge.sha256.create().update(this.header).digest().toHex();
                    this.rid = this.header;
                    break
                }
                if (parseInt(this.header, 16) < this.strength && !this.symmetric_key) {
                    this.header = forge.sha256.create().update(this.header).digest().toHex();
                    this.symmetric_key = this.header;
                }
            }
            return resolve();
        }.bind(this));
    }

    async encryptSeed() {
        return new Promise(function(resolve, reject){
            var encrypted_seed = this.encrypt(this.symmetric_key, this.user.wif);
            return resolve(encrypted_seed)
        }.bind(this));
    }

    encrypt(keyStr, message) {
        var key = forge.pkcs5.pbkdf2(forge.sha256.create().update(keyStr).digest().toHex(), 'salt', 400, 32);
        var cipher = forge.cipher.createCipher('AES-CBC', key);
        var iv = forge.random.getBytesSync(16);
        cipher.start({iv: iv});
        cipher.update(forge.util.createBuffer(iv + btoa(message)));
        cipher.finish()
        return cipher.output.toHex();
    }

    async decryptSeed() {
        return new Promise(function(resolve, reject){
            fetch(this.url_prefix + '/digup?rid=' + this.rid, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                }
            })
            .then(async (result) => {
                var data = await result.json();
                console.log(data);
                if (data.status === false) {
                    return reject(data);
                }
                let decryptedData = this.decrypt(this.symmetric_key, data.relationship);
                return resolve(decryptedData);
            })
            .catch((err) => {
                return reject(err);
            });
        }.bind(this));
    }

    decrypt(keyStr, message) {
        var key = forge.pkcs5.pbkdf2(forge.sha256.create().update(keyStr).digest().toHex(), 'salt', 400, 32);
        var decipher = forge.cipher.createDecipher('AES-CBC', key);
        var enc = this.hexToBytes(message);
        decipher.start({iv: enc.slice(0,16)});
        decipher.update(forge.util.createBuffer(enc.slice(16)));
        decipher.finish();
        return atob(decipher.output.data);
    }

    createUser(username) {
        return new Promise(async function(resolve, reject){
            const ECPair = ec('secp256k1');
            var key = ECPair.genKeyPair();
            var private_key = key.getPrivate().toString('hex');
            var public_key = key.getPublic().encode('hex');
            var wif = this.toWif(private_key);
            return resolve({
                username_signature: this.generate_username_signature(key, username),
                username: username,
                private_key: private_key,
                public_key: public_key,
                key: key,
                wif: wif
            })
        }.bind(this));
    }

    reviveUser(wif, username) {
        return new Promise(function(resolve, reject){
            const ECPair = ec('secp256k1')
            var private_key = this.fromWif(wif);
            var key = ECPair.keyFromPrivate(private_key)
            var public_key = key.getPublic().encode('hex');
            this.user = {
                username_signature: this.generate_username_signature(key, username),
                username: username,
                public_key: public_key,
                key: key,
                wif: wif
            }
            return resolve(this.user);
        }.bind(this));
    }

    sign(message, user) {
        return new Promise(function(resolve, reject){
            var hash = forge.sha256.create().update(message).digest().toHex()
            var der = user.key.sign(hash).toDER();
            return resolve(base64.fromByteArray(der));
        }.bind(this));
    }

    verify(message, user, signature) {
        const ECPair = ec('secp256k1');
        var hash = forge.sha256.create().update(message).digest().toHex()
        var pubKey = ECPair.keyFromPublic(user.public_key, 'hex');
        var result = pubKey.verify(hash, base64.toByteArray(signature));
        return result;
    }

    toWif(private_key) {
      var privateKeyAndVersion = "80" + private_key
      var firstSHA = forge.sha256.create().update(privateKeyAndVersion).digest()
      var secondSHA = forge.sha256.create().update(firstSHA.toHex()).digest()
      var checksum = secondSHA.toHex().substr(0, 8).toLowerCase()
      console.log(checksum) //"206EC97E"

      //append checksum to end of the private key and version
      var keyWithChecksum = privateKeyAndVersion + checksum
      console.log(keyWithChecksum) //"801184CD2CDD640CA42CFC3A091C51D549B2F016D454B2774019C2B2D2E08529FD206EC97E"

      return binary_to_base58(this.hexToByteArray(keyWithChecksum))
    }

    fromWif(wif) {
      var private_key = this.toHex(base58_to_binary(wif))
      console.log(private_key) //"801184CD2CDD640CA42CFC3A091C51D549B2F016D454B2774019C2B2D2E08529FD206EC97E"

      return private_key.substr(2, private_key.length-8)
    }

    verifyIssuedCredential(issuer, message, issuer_signature) {
        return this.verify(message, issuer, issuer_signature);
    }

    verifySubjectRequestedCredential(subject, message, subject_signature) {
        return this.verify(message, subject, subject_signature);
    }

    verifyVerifierRequestedCredential(verifier, message, verifier_signature) {
        return this.verify(message, verifier, verifier_signature);
    }

    signSession(session_id, user) {
        return this.sign(session_id, user)
    }

    signIn(session_id, user, signin_url) {
        return this.signSession(session_id, user)
        .then(function(signature) {
            return new Promise(async function(resolve, reject){
                var res = await fetch(this.addHttp(signin_url || '/sign-in'), {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username_signature: user.username_signature,
                        session_id_signature: signature
                    })
                });
                return resolve(res.json());
            }.bind(this));
        }.bind(this));
    }

    signInWithLocation(session_id_url, private_username, public_username, lat, long, signin_url) {
        var session_uuid;
        var public_user;
        var url = this.addHttp(session_id_url || '/generate-session-uuid');
        return fetch(url + '?' + this.origin + '&api_key=' + encodeURIComponent(this.api_key || ''), {credentials: 'include'})
        .then(async function(result) {
            var json = await result.json();
            session_uuid = json.session_uuid;
            return this.get(private_username, lat, long)
        }.bind(this))
        .then(async function(user) {
            public_user = await this.reviveUser(
                user.wif,
                public_username
            )
            if (this.use_local_storage){
                localStorage.setItem('wif', public_user.wif);
                localStorage.setItem('public_key', public_user.public_key);
                localStorage.setItem('username', public_user.username);
            }
            return this.sign(session_uuid, user);
        }.bind(this))
        .then(function(signature) {
            return new Promise(async function(resolve, reject){
                var post_vars = {
                    user: {
                        username: public_user.username,
                        public_key: public_user.public_key,
                        username_signature: public_user.username_signature,
                    },
                    session_id_signature: signature
                };
                var url = this.addHttp(signin_url || '/sign-in')
                try {
                    var res = await fetch(url + '?' + this.origin, {
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(post_vars),
                        method: 'POST',
                        credentials: 'include'
                    });
                    return resolve(res.json());
                } catch(err) {
                    return reject(err.responseJSON)
                }
            }.bind(this));
        }.bind(this))
        .then(function(res) {
            return new Promise((resolve, reject) => {
                res.user = public_user;
                return resolve(res);
            })
        }.bind(this))
        .catch(function(err) {
            return err
        }.bind(this));
    }

    registerWithLocation(session_id_url, private_username, public_username, lat, long, other_args, register_url) {
        var session_uuid;
        var public_user;
        var url = this.addHttp(session_id_url || '/generate-session-uuid');
        var customer;
        return fetch(url + '?' + this.origin + '&api_key=' + encodeURIComponent(this.api_key || ''), {credentials: 'include'})
        .then(async function(result) {
            var json = await result.json();
            session_uuid = json.session_uuid;
            customer = json.customer;
            return this.setFromNew(private_username, lat, long);
        }.bind(this))
        .then(async function(user) {
            public_user = await this.reviveUser(
                user.wif,
                public_username
            )
            return this.sign(session_uuid, user);
        }.bind(this))
        .then(function(signature) {
            return new Promise(async (resolve, reject) => {
                if (this.use_local_storage){
                    localStorage.setItem('wif', public_user.wif);
                    localStorage.setItem('public_key', public_user.public_key);
                    localStorage.setItem('username', public_user.username);
                }
                var post_vars = {};
                if (customer) {
                    var join = await this.createRelationship(public_user, customer);
                    var dh_keys = this.get_dh_keys(public_user, customer);
                    join.relationship.dh_private_key = dh_keys.dh_private_key
                    var encryptedRelationship = await this.encrypt(public_user.wif, JSON.stringify(join.relationship));
                    post_vars = {
                        api_key: this.api_key,
                        dh_public_key: dh_keys.dh_public_key,
                        relationship: encryptedRelationship
                    }
                }

                post_vars.user = {
                    username: public_user.username,
                    public_key: public_user.public_key,
                    username_signature: public_user.username_signature
                };

                post_vars.session_id_signature = signature;

                post_vars = Object.assign({}, post_vars, other_args);
                var url = this.addHttp(register_url || '/add-user');
                try {
                    var result = await fetch(url + '?' + this.origin, {
                        headers: {
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(post_vars),
                        method: 'POST',
                        credentials: 'include'
                    })
                    return resolve(result.json());
                } catch(err) {
                    return reject(err);
                }
            })
        }.bind(this))
        .then(function(res) {
            return new Promise((resolve, reject) => {
                res.user = public_user;
                return resolve(res);
            })
        }.bind(this))
        .catch(function(err) {
            return err
        }.bind(this));
    }

    addUser(user, url=null) {
        return fetch(this.addHttp(url || '/add-user'), {
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username_signature: user.username_signature,
                username: user.username, // sha256 this in the future
                public_key: user.public_key
            }),
            method: 'POST',
        })
        .then((res) => {
            const data = res.json()
            if (data.status === false) {
                throw data;
            }
        });
    }

    getUser(user, url=null) {
        return fetch(this.addHttp(url || '/get-user'), {
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username_signature: user.username_signature
            }),
            method: 'POST',
        }).then((res) => {
            const data = res.json()
            if (data.status === false) {
                throw data;
            }
        });
    }

    get_dh_keys(me, them) {
        var raw_dh_private_key = forge.sha256.create().update(me.wif + them.username_signature).digest().toHex();
        var raw_dh_public_key = X25519.getPublic(this.hexToByteArray(raw_dh_private_key));
        return {
            dh_private_key: this.toHex(raw_dh_private_key),
            dh_public_key: this.toHex(raw_dh_public_key)
        }
    }

    getSharedSecret(me, them, their_txn) {
        var dh_keys = this.get_dh_keys(me, them);
        var privk = new Uint8Array(dh_keys.dh_private_key.match(/[\da-f]{2}/gi).map(function (h) {
            return parseInt(h, 16)
        }));
        var pubk = new Uint8Array(their_txn.dh_public_key.match(/[\da-f]{2}/gi).map(function (h) {
            return parseInt(h, 16)
        }));
        return this.toHex(X25519.getSharedKey(privk, pubk));
    }

    async authenticate(service_url='', challenge_url='') {
      const userJson = JSON.parse(localStorage.getItem('identity'));
      const user = this.reviveUser(userJson.wif, userJson.username);
      const result = await fetch(
        service_url,
        {
          body: JSON.stringify({
            challenge,
            identity: this.toObject(user)
          }),
          headers: {
            'Content-type': 'application/json'
          },
        }
      );
      const challenge = await result.json()
      const signature = this.sign(challenge.message, user);
      challenge.signature = signature
      await fetch(
        challenge_url + '/challenge',
        {
          body: JSON.stringify({
            challenge,
            identity: this.toObject(user)
          }),
          headers: {
            'Content-type': 'application/json'
          },
        }
      );
    }

    generate_username_signature(key, username) {
        return base64.fromByteArray(key.sign(forge.sha256.create().update(username).digest().toHex()).toDER());
    }

    toHex(byteArray) {
      var callback = function(byte) {
        return ('0' + (byte & 0xFF).toString(16)).slice(-2);
      }
      return Array.from(byteArray, callback).join('')
    }

    hexToBytes(s) {
      var arr = []
      for (var i = 0; i < s.length; i += 2) {
        var c = s.substr(i, 2);
        arr.push(parseInt(c, 16));
      }
      var result = String.fromCharCode.apply(null, arr);
      return result
    }

    hexToByteArray(s) {
      var arr = []
      for (var i = 0; i < s.length; i += 2) {
        var c = s.substr(i, 2);
        arr.push(parseInt(c, 16));
      }
      return new Uint8Array(arr)
    }

    generate_rid(user1, user2, extra_data='') {
        var bulletin_secrets = [user1.username_signature, user2.username_signature].sort(function (a, b) {
            return a.toLowerCase().localeCompare(b.toLowerCase());
        });
        return forge.sha256.create().update(bulletin_secrets[0] + bulletin_secrets[1] + extra_data).digest().toHex();
    }

    async generateTransaction(
        user,
        public_key,
        dh_public_key,
        rid,
        relationship,
        fee,
        requester_rid,
        requested_rid
    ) {
        var transaction = {
            rid:  rid,
            fee: fee,
            dh_public_key: dh_public_key,
            requester_rid: requester_rid || '',
            requested_rid: requested_rid || '',
            outputs: [],
            inputs: [],
            time: parseInt(((+ new Date()) / 1000).toString()).toString(),
            public_key: public_key,
            relationship: relationship
        };
        var header = (
            transaction.public_key +
            transaction.time +
            transaction.dh_public_key +
            transaction.rid +
            transaction.relationship +
            transaction.fee.toFixed(8) +
            transaction.requester_rid +
            transaction.requested_rid
        )
        transaction.hash = forge.sha256.create().update(header).digest().toHex()

        transaction.id = await this.sign(header, user);
        return transaction;
    }

    theirIdentityFromTransaction(txn, their_txn) {
        var out = {
            username: txn.relationship.their_username,
            username_signature: txn.relationship.their_username_signature,
            public_key: txn.relationship.their_public_key,
            dh_private_key: txn.relationship.dh_private_key
        }
        if (their_txn) {
            out.dh_public_key = their_txn.dh_public_key
        }
        return out;
    }

    theirIdentityFromEncryptedTransaction(me, txn, their_txn) {
      var copy_txn = JSON.parse(JSON.stringify(txn));
      var relationship = JSON.parse(this.decrypt(me.wif, copy_txn.relationship));
      copy_txn.relationship = relationship;
      return this.theirIdentityFromTransaction(copy_txn, their_txn);
    }

    myIdentityFromTransaction(txn) {
        return {
            username: txn.relationship.my_username,
            username_signature: txn.relationship.my_username_signature,
            public_key: txn.relationship.my_public_key,
        }
    }

    messageFromEncryptedTransaction(me, them, their_txn, txn) {
      var copy_txn = JSON.parse(JSON.stringify(txn));
      var shared_secret = this.getSharedSecret(me, them, their_txn);
      var relationship = JSON.parse(this.decrypt(shared_secret, copy_txn.relationship));
      return relationship;
    }

    async generateGroupMessageTransaction(me, them, group, message) {
        var shared_secret = this.getSharedSecret(me, them, their_txn);
        var encryptedChatRelationship = await this.encrypt(shared_secret, message);

        if (group) {
            requested_rid = this.generate_rid(
                group,
                user,
            )
            requester_rid = this.generate_rid(
                group,
                me,
            )
        } else {
          requester_rid = '';
          requested_rid = '';
        }

        return await this.generateTransaction(
            me,
            me.public_key,
            '',
            this.generate_rid(me, them),
            encryptedChatRelationship,
            0,
            requester_rid,
            requested_rid
        );
    }

    async generatePrivateMessageTransaction(me, them, their_txn, message, collection) {
        var shared_secret = this.getSharedSecret(me, them, their_txn);
        var encryptedChatRelationship = await this.encrypt(shared_secret, message);
        return await this.generateTransaction(
            me,
            me.public_key,
            '',
            this.generate_rid(me, them, collection),
            encryptedChatRelationship,
            0,
            '',
            ''
        );
    }

    async getTransactionsByRid(rid) {
      return fetch(this.url_prefix + '/get-transaction-by-rid?rid=' + rid)
    }

    async getTransactionsByRequestedRid(rid) {
      return fetch(this.url_prefix + '/get-transaction-by-rid?requested_rid=' + rid)
    }

    async getTransactionsByRequesterRid(rid) {
      return fetch(this.url_prefix + '/get-transaction-by-rid?requester_rid=' + rid)
    }

    async getRelationshipTransactions(me, them, collection) {
      var theirRel = '';
      var myRel = '';
      var rid = this.generate_rid(me, them, collection);

      return this.getTransactionsByRid(rid)
      .then(async (res) => {
        var txns = await res.json()
        for (var i=0;i<txns.length;i++) {
          if (me.public_key === txns[i].public_key && txns[i].dh_public_key) {
            myRel = txns[i];
            if (theirRel) break;
          }
          if (me.public_key !== txns[i].public_key && txns[i].dh_public_key) {
            theirRel = txns[i];
            if (myRel) break;
          }
        }
        if (!myRel) throw {
          status: false,
          message: 'relationship not complete: you have not added them',
          mine: myRel,
          theirs: theirRel
        };
        if (!theirRel) throw {
          status: false,
          message: 'relationship not complete: they have not added you',
          mine: myRel,
          theirs: theirRel
        };
        return {mine: myRel, theirs: theirRel}
      })
      .catch((err) => {
        console.log(err);
      });
    }
    async getIdentitiesByCollection(me, collection, friendList) {
      var group = await this.reviveUser(this.friends_list_wif, collection);
      if(friendList) {
        group = friendList;
      }
      var rid = this.generate_rid(me, group);
      var result = await this.getTransactionsByRequesterRid(rid);
      var txns = await result.json();
      var collection = await Promise.all(txns.map(async (txn) => {
        return await this.theirIdentityFromEncryptedTransaction(me, txn)
      }));
      return collection;
    }

    async getDataByCollection(me, collection, friendList) {
      var group = await this.reviveUser(this.friends_list_wif, collection);
      if(friendList) {
        group = friendList;
      }
      var rid = this.generate_rid(me, group);
      var result = await this.getTransactionsByRequesterRid(rid);
      var txns = await result.json();
      var collection = await Promise.all(txns.map(async (txn) => {
        var copy_txn = JSON.parse(JSON.stringify(txn));
        var relationship = JSON.parse(this.decrypt(me.wif, copy_txn.relationship));
        return relationship;
      }));
      return collection;
    }

    async getFriendsLists(me, listName) {
      var friendsList = await this.reviveUser(this.friends_list_wif, listName);
      var rid = this.generate_rid(me, friendsList, me.wif + ':all_friends_lists');
      return this.getTransactionsByRid(rid)
      .then(async (txns) => {
        return txns;
      });
    }

    async getFriendsList(me, listName) {
      var friendsList = await this.reviveUser(this.friends_list_wif, listName);
      var rid = this.generate_rid(me, friendsList, me.wif + ':all_friends_lists');
      return this.getTransactionsByRid(rid)
      .then(async (txns) => {
        if (txns.length === 0) {
          var friendsList = await this.reviveUser(this.friends_list_wif, 'default');
          return this.createRelationshipTransaction(me, friendsList, null, me.wif + ':all_friends_lists');
        }
        for(var i=0; i < txns.length; i++) {
          var friendList = await this.theirIdentityFromEncryptedTransaction(me);
          if (friendList.username === listName) {
            return friendList;
          }
        }
      });
    }

    async setFriendsList(me, listName) {
      var friendsList = await this.createUser(listName);
      return this.createRelationshipTransaction(me, friendsList, null, me.wif + ':all_friends_lists');
    }

    async getPrivateMessages(me, them, collection, filter) {
      var res = {};
      return fetch(this.url_prefix + '/get-transaction-by-rid?rid=' + this.generate_rid(me, them, collection))
      .then(async (res) => {
        return this.getRelationshipTransactions(me, them);
      })
      .then(async (rels) => {
        myRel = rels.mine;
        theirRel = rels.theirs;
        var txn = await res.json()
        var messages = []
        for (var i=0; i < txn.length; i++) {
          if(txn[i].dh_public_key === '') {
            var messageTxn = txn[i];
            var theirIdentity = this.theirIdentityFromEncryptedTransaction(me, myRel);
            var message = this.messageFromEncryptedTransaction(me, theirIdentity, theirRel, messageTxn);
            //if (filter && !filter(message)) continue;
            messages.push(message);
          }
        }
        return messages;
      });
    }

    async sendPrivateMessage(me, them, collection, message) {
      var myRel = {};
      var theirRel = {}
      return this.getRelationshipTransactions(me, them)
      .then(async (rels) => {
        myRel = rels.mine;
        theirRel = rels.theirs;
        //get verifier identity for subject
        var theirIdentity = this.theirIdentityFromEncryptedTransaction(me, myRel);
        ///create message
        var privateMessage = await this.generatePrivateMessageTransaction(
          me,
          theirIdentity,
          theirRel,
          message,
          collection
        );
        return await fetch(this.url_prefix + '/transaction?bulletin_secret=fu&' + this.origin, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(privateMessage)
        });
      })
      .then(async (res) => {
        var privateMessage = await res.json();
        return privateMessage;
      });
    }

    async issueCredential(me, them, credential, credentialMessage) {
      var collection = 'credential_issues';
      Object.assign(credential, {
        issuer: this.toObject(me),
        subject: this.toObject(them)
      })
      var issuerSignature = await this.sign(credentialMessage, me);
      var relationshipMessage = JSON.stringify(Object.assign({}, credential, {
        issuer_signature: issuerSignature
      }))
      return {
        transaction: await this.sendPrivateMessage(me, them, collection, relationshipMessage),
        message: relationshipMessage
      };
    }

    async getCredentialsIssued(me, them, credential) {
      return this.getPrivateMessages(
        me,
        them,
        'credential_issues',
        credential
      )
    }

    async getCredentialsRequested(me, them, credential) {
      return this.getPrivateMessages(
        me,
        them,
        'credential_requests',
        credential
      )
    }

    async requestCredentialFromIssuer(me, issuer, credential) { // me = subject
      var collection = 'credential_requests';
      Object.assign(credential, {
        issuer: this.toObject(issuer),
        subject: this.toObject(me)
      })
      var signedCredential = await this.sign(JSON.stringify(credential), me);
      var message = JSON.stringify({
        credential: credential,
        subject_signature: signedCredential
      });
      return await this.sendPrivateMessage(me, issuer, collection, message);
    }

    async requestCredentialThroughSubject(me, issuer, subject, credential) { // me = verifier
      var collection = 'credential_requests';
      Object.assign(credential, {
        issuer: this.toObject(issuer),
        subject: this.toObject(subject),
        verifier: this.toObject(me)
      });
      var signedCredential = await this.sign(JSON.stringify(credential), me);
      var message = JSON.stringify({
        credential: credential,
        verifier_signature: signedCredential
      });
      return await this.sendPrivateMessage(me, subject, collection, message);
    }

    async forwardIssuedCredential(me, issuer, verifier, credential) { // me = subject, them = verifier
      var signedCredential = await this.sign(JSON.stringify(credential), me);
      var message = JSON.stringify(Object.assign(credential, {
        subject_signature: signedCredential
      }));
      return await this.sendPrivateMessage(me, verifier, 'credential_issues', message);
    }

    async forwardRequestedCredential(me, issuer, verifier, credential) { // me = subject, them = issuer
      var signedCredential = await this.sign(JSON.stringify(credential), me);
      var message = JSON.stringify(Object.assign(credential, {
        subject_signature: signedCredential
      }));
      return await this.sendPrivateMessage(me, issuer, 'credential_requests', message);
    }

    async getIdentityLink(identity) {
      return fetch(this.url_prefix + '/sia-upload?filename=' + encodeURIComponent(identity.username_signature), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({file: btoa(JSON.stringify(this.toObject(identity)))})
      })
      .then(async (res) => {
        var json = await res.json();
        return json.skylink;
      });
    }

    async getCredentialLink(credential) {
      return fetch(this.url_prefix + '/sia-upload?filename=' + encodeURIComponent(credential.identity.username_signature), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({file: btoa(JSON.stringify(credential))})
      })
      .then(async (res) => {
        var json = await res.json();
        return json.skylink;
      });
    }

    async connectIdentities(me, them, friendList, collection, extra_data) {
      if (!friendList) {
        friendList = await this.reviveUser(this.friends_list_wif, collection || 'default');
      }
      var myRel = await this.createRelationshipTransaction(me, them, friendList, extra_data);
      await fetch(this.url_prefix + '/transaction?bulletin_secret=fu&' + this.origin, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(myRel)
      });
      return them;
    }

    async addCredential(me, credential, friendList, collection) {
      credential.identity = this.toObject(credential.identity)
      await this.connectIdentities(
        me,
        this.copy(credential.identity),
        friendList,
        collection || 'credentials',
        this.copy({credential: credential})
      )
    }

    async importConnectionFromSkylink(me, skylink, collection, friendList, extra_data) {
      var group = await this.reviveUser(this.friends_list_wif, collection || 'default');
      if(friendList) {
        group = friendList;
      }
      return fetch('https://siasky.net/' + skylink)
      .then(async (res) => {
        var them = await res.json();
        return this.connectIdentities(me, them, group, collection, extra_data);
      });
    }

    addHttp(url) {
      return url.substr(0, 4) === 'http' ? url : this.url_prefix + url
    }

    async signOut() {
    }

    copy(data) {
      return JSON.parse(JSON.stringify(data));
    }

    toObject(user) {
        return {
            username: user.username,
            username_signature: user.username_signature,
            public_key: user.public_key
        }
    }

    toJson(user) {
        return JSON.stringify({
            username: user.username,
            username_signature: user.username_signature,
            public_key: user.public_key,
            wif: user.wif
        })
    }
}
