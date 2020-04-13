import chai from 'chai'; 
import CenterIdentity from './src/index';

test('revive user', async () => {
    var wif = 'Kyxz7dFa8E1n5hsfWzrc5nvecLa76kBdUFj3wtbikszK2ttYHBPw';
    var username = 'test_username';
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    expect(user.wif).toBe(wif);
    expect(user.wif).toBe(wif);
});

test('create user', async () => {
    var username = 'test_username';
    var ci = new CenterIdentity();
    var user = await ci.createUser(username);
    expect(user.username).toBe(username);
});

test('set seed', async () => {
    var wif = 'Kyxz7dFa8E1n5hsfWzrc5nvecLa76kBdUFj3wtbikszK2ttYHBPw';
    var username = 'test_username';
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    var response = await ci.set(user, '45.525', '-122.684');
    expect(response.status).toBe('success');
});

test('get seed', async () => {
    var wif = 'Kyxz7dFa8E1n5hsfWzrc5nvecLa76kBdUFj3wtbikszK2ttYHBPw';
    var username = 'test_username';
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    var user = await ci.get(username, '45.525', '-122.684');
    expect(user.username).toBe(username);
    expect(user.wif).toBe(wif);
});

test('add user', async () => {
    var username = 'test_username';
    var ci = new CenterIdentity();
    var user = await ci.createUser(username);
    var response = await ci.addUser(user, 'http://0.0.0.0:8000/add-user-test');
    expect(response.status).toBe(true);
});

test('sign session id', async () => {
    // Service will collect username, public_key, bulletin_secret
    var wif = 'Kyxz7dFa8E1n5hsfWzrc5nvecLa76kBdUFj3wtbikszK2ttYHBPw';
    var username = 'test_username';
    var session_id = 'alskdfjsalfkj2l2k3j4'
    var ci = new CenterIdentity();
    var user = await ci.reviveUser(wif, username);
    var signature = await ci.signSession(session_id, user);
    expect(signature).toBe('MEQCICR33kqg7nAQsdDLbopkGdUp1eSMmjF2FTmxqAVs9MPtAiBC/8zaqcSXF7FN00R5nt3vIMyu5Fa6KDHolhSpKaPwvg==');
});
