import chai, { expect } from 'chai'; 
import CenterIdentity from './src/index';
global.fetch = require("node-fetch");


// test('revive user', async () => {
//     var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
//     var username = 'test_service';
//     var ci = new CenterIdentity();
//     var user = await ci.reviveUser(wif, username);
//     expect(user.wif).to.equal(wif);
//     expect(user.wif).to.equal(wif);
// });

// test('create user', async () => {
//     var username = 'test_service';
//     var ci = new CenterIdentity();
//     var user = await ci.createUser(username);
//     expect(user.username).to.equal(username);
// });

// test('set seed', async () => {
//     var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
//     var username = 'test_service';
//     var ci = new CenterIdentity();
//     var user = await ci.reviveUser(wif, username);
//     var response = await ci.set(user, '45.525', '-122.684');
//     expect(response.status).to.equal('success');
// });

// test('set seed from new', async () => {
//     var username = 'test_service';
//     var ci = new CenterIdentity();
//     var user = await ci.setFromNew(username, '45.522', '-122.685');
//     expect(user.username).to.equal('test_service');
// });

// test('get seed', async () => {
//     var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
//     var username = 'test_service';
//     var ci = new CenterIdentity();
//     var user = await ci.reviveUser(wif, username);
//     await ci.get(username, '45.525', '-122.684');
//     expect(ci.user.username).to.equal(username);
//     expect(ci.user.wif).to.equal(wif);
// });

// test('add user', async () => {
//     var username = 'test_service';
//     var ci = new CenterIdentity();
//     var user = await ci.createUser(username);
//     var response = await ci.addUser(user, 'http://0.0.0.0:8000/add-user-test');
//     expect(response.status).to.equal(true);
// });

// test('sign session uuid', async () => {
//     // Service will collect username, public_key, bulletin_secret
//     var wif = 'L38yoTWooppsQD4FubNfg9BmhZSvec5jnQMxLKD3si2GHA3g9gJk';
//     var username = 'test_service';
//     var session_uuid = 'lj2l34kj23l4kj234lk2j34'
//     var ci = new CenterIdentity();
//     var user = await ci.reviveUser(wif, username);
//     ci.user = user;
//     var signature = await ci.signSession(session_uuid, user);
//     expect(signature).to.equal('MEQCIFPEt5a2EuyAAkqQJnd7d8h+zpVh7CXRugAb/avROOSgAiBghIBGtk/ksOwQj2YTYv0UA/UbDOxnvaRqiirYpj5UhQ==');
// });

test('issue credential', async () => {
    var issuer_wif = 'L1cFWckX6oue3XsNPKZqzGpvM5xH58xcNSXD9ybwt8nMQSVudZyb';
    var subject_wif = 'L3ibVZ6BPhLMbAtzGyER1hskU5pNTxRavacnxCQmsuAXB743Y6uA';
    var verifier_wif = 'L3acSEESa99mX3CJjQhJsHigiUvpCotpwgTCDAwPQCgJGAM2jwHT';
    var ci = new CenterIdentity();
    var issuer = await ci.reviveUser(issuer_wif, 'issuer');
    var subject = await ci.reviveUser(subject_wif, 'subject');
    var verifier = await ci.reviveUser(verifier_wif, 'verifier');
    var issuerLink = 'AADT4ZrAWSJd_IGpRvqKgp3WI2Yc_71eSe7Yguna_8tc-g';
    var subjectLink = 'AACeZwVk_DthDOrwDwT-cQSgf0igZrvoHsgcTgJKntkscw';
    var verifierLink = 'AADemS4-cdHPN_YiiPukNd8GRnVBtRNmHtkdMMcAvj3Bgg';

    await ci.importConnectionFromSkylink(issuer, subjectLink);
    await ci.importConnectionFromSkylink(issuer, verifierLink);

    await ci.importConnectionFromSkylink(subject, issuerLink);
    await ci.importConnectionFromSkylink(subject, verifierLink);

    await ci.importConnectionFromSkylink(verifier, issuerLink);
    await ci.importConnectionFromSkylink(verifier, subjectLink);

    var credential = {
      allow_access: true
    };

    // var itxn = await ci.issueCredential(
    //   issuer,
    //   subject,
    //   credential
    // )
    // expect(itxn.rid).to.equal(ci.generate_rid(issuer, subject, 'credential_issues'));

    // var rtxn = await ci.requestCredential(
    //   verifier,
    //   subject,
    //   credential
    // )
    // expect(rtxn.rid).to.equal(ci.generate_rid(subject, verifier, 'credential_requests'));

    var ftxn = await ci.forwardIssuedCredential(
      subject,
      issuer,
      verifier,
      'allow_access'
    );
    console.log(ftxn);
    expect(rtxn.rid).to.equal(ci.generate_rid(subject, verifier, 'credential_issues'));

    // var ftxn2 = await ci.forwardCredentialRequest(
    //   subject,
    //   issuer,
    //   verifier,
    //   'allow_access'
    // );
    // expect(rtxn2.rid).to.equal(ci.generate_rid(subject, issuer, 'credential_requests'));
});



