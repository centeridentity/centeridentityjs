import chai from 'chai'; 
import CenterIdentity from './src/index';


test('revive user', async () => {
    var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
    var username = 'test_service';
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    expect(user.wif).toBe(wif);
    expect(user.wif).toBe(wif);
});

test('create user', async () => {
    var username = 'test_service';
    var ci = new CenterIdentity();
    var user = await ci.createUser(username);
    expect(user.username).toBe(username);
});

test('set seed', async () => {
    var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
    var username = 'test_service';
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    var response = await ci.set(user, '45.525', '-122.684');
    expect(response.status).toBe('success');
});

test('set seed from new', async () => {
    var username = 'test_service';
    var ci = new CenterIdentity();
    var user = await ci.setFromNew(username, '45.525', '-122.684');
    expect(user.username).toBe('test_service');
});

test('get seed', async () => {
    var wif = 'KxdzNJvL7h1w4M7kUDLb8e3iHv1cmc5omHzz8PzVuFCss7x4FuuR';
    var username = 'test_service';
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    await ci.get(username, '45.525', '-122.684');
    expect(ci.user.username).toBe(username);
    expect(ci.user.wif).toBe(wif);
});

test('add user', async () => {
    var username = 'test_service';
    var ci = new CenterIdentity();
    var user = await ci.createUser(username);
    var response = await ci.addUser(user, 'http://0.0.0.0:8000/add-user-test');
    expect(response.status).toBe(true);
});

test('sign session uuid', async () => {
    // Service will collect username, public_key, bulletin_secret
    var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
    var username = 'test_service';
    var session_uuid = 'lj2l34kj23l4kj234lk2j34'
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    ci.user = user;
    var signature = await ci.signSession(session_uuid);
    expect(signature).toBe('MEUCIQDaGQ43kgJZEmu6X7B5k+W61roLqwWfZSxsWB2QNCQaNwIgAUpv7JAwaqM+iDIRniD1+xmfB0AvcfxdNnc0wKM5eKc=');
});


