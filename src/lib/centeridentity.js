import forge from 'node-forge';
import jQuery from 'jquery';
import * as bitcoin from 'bitcoinjs-lib';
import base64 from 'base64-js';
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
    async set(user, latitude, longitude) {
        return new Promise(function(resolve, reject){
            this.user = user;
            this.seed = user.wif;
            this.longitude = longitude;
            this.latitude = latitude;
            return resolve();
        }.bind(this))
        .then(function(){
            return this.getLocation();
        }.bind(this))
        .then(function(position){
            return this.showPosition(user.username, position);
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
            this.user = await this.reviveUser(wif, username);
        }.bind(this))
        .catch(function(err) {
            console.log(err)
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
            var key = forge.pkcs5.pbkdf2(forge.sha256.create().update(this.symmetric_key).digest().toHex(), 'salt', 400, 32);
            var cipher = forge.cipher.createCipher('AES-CBC', key);
            var iv = forge.random.getBytesSync(16);
            cipher.start({iv: iv});
            cipher.update(forge.util.createBuffer(iv + btoa(this.seed)));
            cipher.finish()
            var encrypted_seed =  cipher.output.toHex();
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

    async decryptSeed() {
        return new Promise(function(resolve, reject){
            $.ajax({
                url: this.url_prefix + '/digup?rid=' + this.rid,
                dataType: 'json',
                type: 'GET',
                success: function(data, textStatus, jqXHR) {
                    if (data.status === 'not found') {
                        return reject(data);
                    }
                    var key = forge.pkcs5.pbkdf2(forge.sha256.create().update(this.symmetric_key).digest().toHex(), 'salt', 400, 32);
                    var decipher = forge.cipher.createDecipher('AES-CBC', key);
                    var enc = this.hexToBytes(data.relationship);
                    decipher.start({iv: enc.slice(0,16)});
                    decipher.update(forge.util.createBuffer(enc.slice(16)));
                    decipher.finish();
                    return resolve(atob(decipher.output.data));
                }.bind(this),
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    return reject(errorThrown);
                }.bind(this)
            });
        }.bind(this));
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
            return resolve({
                username_signature: this.generate_username_signature(key, username),
                username: username,
                wif: wif,
                public_key: public_key,
                key: key
            })
        }.bind(this));
    }

    signSession(session_id) {
        return new Promise(function(resolve, reject){
            var hash = bitcoin.crypto.sha256(session_id).toString('hex');
            var combine = new Uint8Array(hash.length);
            for (var i = 0; i < hash.length; i++) {
                combine[i] = hash.charCodeAt(i)
            }
            var shaMessage = bitcoin.crypto.sha256(combine);
            var der = this.user.key.sign(shaMessage).toDER();
            return resolve(base64.fromByteArray(der));
        }.bind(this));
    }

    signIn(session_id, user, signin_url) {
        this.user = user;
        return this.signSession(session_id)
        .then(function(signature) {
            return new Promise(async function(resolve, reject){
                var res = await $.ajax({
                    url: signin_url || '/sign-in',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify({
                        username_signature: this.user.username_signature,
                        signature: signature
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
            return this.signSession(session_id);
        }.bind(this))
        .then(function(signature) {
            return new Promise(async function(resolve, reject){
                var res = await $.ajax({
                    url: signin_url || '/sign-in',
                    dataType: 'json',
                    contentType: "application/json",
                    data: JSON.stringify({
                        username_signature: this.user.username_signature,
                        signature: signature
                    }),
                    type: 'POST'
                });
                return resolve(res);
            }.bind(this));
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
                if (data.status === 'failed') {
                    return reject(data);
                }
            }.bind(this),
            error: function(XMLHttpRequest, textStatus, errorThrown) {
                return reject(errorThrown);
            }.bind(this)
        });
    }

    generate_username_signature(key, username) {
        return base64.fromByteArray(key.sign(bitcoin.crypto.sha256(username)).toDER());
    }

    hexToBytes(s) {
        var arr = []
        for (var i = 0; i < s.length; i += 2) {
            var c = s.substr(i, 2);
            arr.push(parseInt(c, 16));
        }
        return String.fromCharCode.apply(null, arr);
    }
}
