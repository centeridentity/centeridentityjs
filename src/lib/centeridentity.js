import forge from 'node-forge';
import jQuery from 'jquery';
import * as bitcoin from 'bitcoinjs-lib';
import base64 from 'base64-js';
import X25519 from 'js-x25519';
var $ = jQuery;
export default class CenterIdentity {
    constructor(strength) {
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
        this.url_prefix = 'https://centeridentity.com'
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

    async createRelationshipTransaction(me, user, group) {
        var join = await this.createRelationship(me, user);
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
            window.localStorage.setItem('wif', wif);
            window.localStorage.setItem('username', username);
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
            var payload =  `{
                "rid": "` + this.rid + `",
                "relationship": "` + encrypted_seed + `"
            }`;
            $.ajax({
                url: this.url_prefix + '/bury',
                contentType: 'application/json',
                dataType: 'json',
                type: 'POST',
                data: payload,
                success: function(data, textStatus, jqXHR) {
                    return resolve(data);
                },
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    return reject(errorThrown);
                }
            });
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
            $.ajax({
                url: this.url_prefix + '/digup?rid=' + this.rid,
                dataType: 'json',
                type: 'GET',
                success: function(data, textStatus, jqXHR) {
                    if (data.status === 'error') {
                        return reject(data);
                    }
                    let decryptedData = this.decrypt(this.symmetric_key, data.relationship);
                    return resolve(atob(decryptedData));
                }.bind(this),
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    return reject(errorThrown);
                }.bind(this)
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
        return new Promise(function(resolve, reject){
            var key = bitcoin.ECPair.makeRandom();
            var wif = key.toWIF();
            var public_key = key.getPublicKeyBuffer().toString('hex');
            return resolve({
                username_signature: this.generate_username_signature(key, username),
                username: username,
                wif: wif,
                public_key: public_key,
                key: key
            })
        }.bind(this));
    }

    reviveUser(wif, username) {
        return new Promise(function(resolve, reject){
            var key = bitcoin.ECPair.fromWIF(wif);
            var public_key = key.getPublicKeyBuffer().toString('hex');
            this.user = {
                username_signature: this.generate_username_signature(key, username),
                username: username,
                wif: wif,
                public_key: public_key,
                key: key
            }
            return resolve(this.user);
        }.bind(this));
    }

    sign(message, user) {
        return new Promise(function(resolve, reject){
            var hash = bitcoin.crypto.sha256(message).toString('hex');
            var combine = new Uint8Array(hash.length);
            for (var i = 0; i < hash.length; i++) {
                combine[i] = hash.charCodeAt(i)
            }
            var shaMessage = bitcoin.crypto.sha256(combine);
            var der = user.key.sign(shaMessage).toDER();
            return resolve(base64.fromByteArray(der));
        }.bind(this));
    }

    signIn(session_id, user, signin_url) {
        return this.sign(session_id, user)
        .then(function(signature) {
            return new Promise(async function(resolve, reject){
                var res = await $.ajax({
                    url: signin_url || '/sign-in',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify({
                        username_signature: user.username_signature,
                        session_id_signature: signature
                    }),
                    type: 'POST'
                });
                return resolve(res);
            }.bind(this));
        }.bind(this));
    }

    signInWithLocation(session_id, username, lat, long, signin_url) {
        return this.get(username, lat, long)
        .then(function(user) {
            return this.sign(session_id, user);
        }.bind(this))
        .then(function(signature) {
            return new Promise(async function(resolve, reject){
                var res = await $.ajax({
                    url: signin_url || '/sign-in',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify({
                        username_signature: this.user.username_signature,
                        session_id_signature: signature
                    }),
                    type: 'POST'
                });
                return resolve(res);
            }.bind(this));
        }.bind(this))
        .catch(function(err) {
            return err
        }.bind(this));
    }

    registerWithLocation(username, lat, long, other_args, register_url) {
        return this.setFromNew(username, lat, long)
        .then(function(user) {
            window.localStorage.setItem('wif', user.wif);
            window.localStorage.setItem('username', user.username);
            return new Promise(async function(resolve, reject){
                var post_vars = {
                    username: username,
                    public_key: user.public_key,
                    username_signature: user.username_signature
                }
                post_vars = {...post_vars, ...other_args}
                return resolve(await $.ajax({
                    url: register_url || '/create-customer',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify(post_vars),
                    type: 'POST'
                }));
            })
        }.bind(this))
        .catch(function(err) {
            return err
        }.bind(this));
    }

    addUser(user, url=null) {
        return $.ajax({
            url: url || this.url_prefix + '/add-user',
            dataType: 'json',
            contentType: "application/json",
            data: JSON.stringify({
                username_signature: user.username_signature,
                username: user.username, // sha256 this in the future
                public_key: user.public_key
            }),
            type: 'POST',
            success: function(data, textStatus, jqXHR) {
                if (data.status === 'error') {
                    throw data;
                }
            }.bind(this),
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                throw XMLHttpRequest;
            }.bind(this)
        });
    }

    getUser(user, url=null) {
        return $.ajax({
            url: url || this.url_prefix + '/get-user',
            dataType: 'json',
            contentType: "application/json",
            data: JSON.stringify({
                username_signature: user.username_signature
            }),
            type: 'POST',
            success: function(data, textStatus, jqXHR) {
                if (data.status === 'error') {
                    throw data;
                }
            }.bind(this),
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                throw errorThrown;
            }.bind(this)
        });
    }

    get_dh_keys(me, them) {
        var raw_dh_private_key = bitcoin.crypto.sha256(me.wif + them.username_signature);
        var raw_dh_public_key = X25519.getPublic(raw_dh_private_key);
        return {
            dh_private_key: this.toHex(raw_dh_private_key),
            dh_public_key: this.toHex(raw_dh_public_key)
        }
    }

    getSharedSecret(me, them) {
        var dh_keys = this.get_dh_keys(me, them);
        var privk = new Uint8Array(dh_keys.dh_private_key.match(/[\da-f]{2}/gi).map(function (h) {
            return parseInt(h, 16)
        }));
        var pubk = new Uint8Array(dh_keys.dh_public_key.match(/[\da-f]{2}/gi).map(function (h) {
            return parseInt(h, 16)
        }));
        return this.toHex(X25519.getSharedKey(privk, pubk));
    }

    generate_username_signature(key, username) {
        return base64.fromByteArray(key.sign(bitcoin.crypto.sha256(username)).toDER());
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
        return String.fromCharCode.apply(null, arr);
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
        transaction.hash = bitcoin.crypto.sha256(
            transaction.public_key +
            transaction.time +
            transaction.dh_public_key +
            transaction.rid +
            transaction.relationship +
            transaction.fee.toFixed(8) +
            transaction.requester_rid +
            transaction.requested_rid
        ).toString('hex')

        transaction.id = await this.sign(transaction.hash, user);
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
      var relationship = JSON.parse(this.decrypt(me.wif, txn.relationship));
      txn.relationship = relationship;
      return this.theirIdentityFromTransaction(txn, their_txn);
    }

    myIdentityFromTransaction(txn) {
        return {
            username: txn.relationship.my_username,
            username_signature: txn.relationship.my_username_signature,
            public_key: txn.relationship.my_public_key,
        }
    }

    async generateGroupMessageTransaction(me, them, group, message) {
        var shared_secret = this.getSharedSecret(me, them);
        var encryptedChatRelationship = await this.encrypt(shared_secret, message);
        return await this.generateTransaction(
            me,
            my_txn.public_key,
            '',
            this.generate_rid(me, this.theirIdentityFromTransaction(my_txn)),
            encryptedChatRelationship,
            0,
            my_txn.requester_rid,
            my_txn.requested_rid
        );
    }

    async generatePrivateMessageTransaction(me, them, message) {
        var shared_secret = this.getSharedSecret(me, them);
        var encryptedChatRelationship = await this.encrypt(shared_secret, message);
        return await this.generateTransaction(
            me,
            my_txn.public_key,
            '',
            this.generate_rid(me, this.theirIdentityFromTransaction(my_txn)),
            encryptedChatRelationship,
            0,
            my_txn.requester_rid,
            my_txn.requested_rid
        );
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
