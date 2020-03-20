exports.CenterIdentity = function(strength) {
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
            this.strength = 0x00000fffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
            break;
    }
    this.bury = async function(username, seed, longitude, latitude) {
        return new Promise(function(resolve, reject){
            this.username = username;
            this.seed = seed;
            this.longitude = longitude;
            this.latitude = latitude;
            return resolve();
        }.bind(this))
        .then(function(){
            return this.getLocation();
        }.bind(this))
        .then(function(position){
            return this.showPosition(position);
        }.bind(this))
        .then(function(position){
            return this.generateRecovery()
        }.bind(this))
        .then(function(position){
            return this.encryptSeed();
        }.bind(this));
    }.bind(this);

    this.dig = async function(username, longitude, latitude) {
        return new Promise(function(resolve, reject){
            this.username = username;
            this.longitude = longitude;
            this.latitude = latitude;
            return resolve();
        }.bind(this))
        .then(function(){
            return this.getLocation();
        }.bind(this))
        .then(function(position){
            return this.showPosition(position);
        }.bind(this))
        .then(function(position){
            return this.generateRecovery()
        }.bind(this))
        .then(function(position){
            return this.decryptSeed();
        }.bind(this));
    }.bind(this);

    this.getLocation = async function() {
        return new Promise(function(resolve, reject){
            if (navigator.geolocation && !(this.longitude && this.latitude)) {
                navigator.geolocation.getCurrentPosition(function(position) { 
                    return resolve(position); 
                }.bind(this));
            } else {
                return resolve({
                    coords: {
                        longitude: parseFloat(this.longitude),
                        latitude: parseFloat(this.latitude)
                    }
                })
            }
        }.bind(this));
    }.bind(this);

    this.showPosition = async function(position) {
        return new Promise(function(resolve, reject){
            lat = position.coords.latitude.toFixed(5);
            long = position.coords.longitude.toFixed(5);
            this.header = long + (lat + this.username);
            return resolve();
        }.bind(this));
    }.bind(this);

    this.generateRecovery = async function() {
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
    }.bind(this);

    this.encryptSeed = async function() {
        return new Promise(function(resolve, reject){
            var key = forge.pkcs5.pbkdf2(forge.sha256.create().update(this.symmetric_key).digest().toHex(), 'salt', 400, 32);
            var cipher = forge.cipher.createCipher('AES-CBC', key);
            var iv = forge.random.getBytesSync(16);
            cipher.start({iv: iv});
            cipher.update(forge.util.createBuffer(iv + Base64.encode(this.seed)));
            cipher.finish()
            var encrypted_seed =  cipher.output.toHex();
            var payload =  `{
                "rid": "` + this.rid + `",
                "relationship": "` + encrypted_seed + `"
            }`;
            $.ajax({
                url: '/bury',
                contentType: 'application/json',
                dataType: 'json',
                type: 'POST',
                data: payload,
                success: function(data, textStatus, jqXHR) {
                    return resolve(data);
                }.bind(this),
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    return reject(data);
                }.bind(this)
            });
        }.bind(this));
    }.bind(this);

    this.decryptSeed = async function() {
        return new Promise(function(resolve, reject){
            $.ajax({
                url: '/digup?rid=' + this.rid,
                dataType: 'json',
                type: 'GET',
                success: function(data, textStatus, jqXHR) {
                    var key = forge.pkcs5.pbkdf2(forge.sha256.create().update(this.symmetric_key).digest().toHex(), 'salt', 400, 32);
                    var decipher = forge.cipher.createDecipher('AES-CBC', key);
                    var enc = this.hexToBytes(data.relationship);
                    decipher.start({iv: enc.slice(0,16)});
                    decipher.update(forge.util.createBuffer(enc.slice(16)));
                    decipher.finish();
                    return resolve(Base64.decode(decipher.output.data));
                }.bind(this),
                error: function(XMLHttpRequest, textStatus, errorThrown) {
                    return reject(data);
                }.bind(this)
            });
        }.bind(this));
    }.bind(this);

    this.hexToBytes = function(s) {
        var arr = []
        for (var i = 0; i < s.length; i += 2) {
            var c = s.substr(i, 2);
            arr.push(parseInt(c, 16));
        }
        return String.fromCharCode.apply(null, arr);
    }.bind(this);
}