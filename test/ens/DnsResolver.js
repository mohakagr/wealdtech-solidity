const ENS = artifacts.require("./ENS.sol");
const MockEnsRegistrar = artifacts.require("./contracts/MockEnsRegistrar.sol");
const DnsResolver = artifacts.require("./contracts/ens/DnsResolver.sol");
const assertRevert = require('../helpers/assertRevert');

const sha3 = require('solidity-sha3').default;

const increaseTime = addSeconds => web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_increaseTime", params: [addSeconds], id: 0 })
const mine = () => web3.currentProvider.send({ jsonrpc: "2.0", method: "evm_mine", params: [], id: 0 })

const ethLabelHash = sha3('eth');
const ethNameHash = sha3('0x0000000000000000000000000000000000000000000000000000000000000000', ethLabelHash);

contract('DnsResolver', (accounts) => {
    // Accounts
    const registryOwner = accounts[0];
    const registrarOwner = accounts[1];
    const resolverOwner = accounts[2];
    const testDomainOwner = accounts[3];

    // Carry ENS etc. over tests
    var registry;
    var registrar;
    var resolver;

    it('should set up the contracts', async() => {
        registry = await ENS.new({ from: registryOwner });
        registrar = await MockEnsRegistrar.new(registry.address, ethNameHash, { from: registrarOwner, value: web3.toWei(10, 'ether') });
        await registry.setSubnodeOwner("0x0", ethLabelHash, registrar.address);
        resolver = await DnsResolver.new(registry.address, { from: resolverOwner })
    });

    it('should track node entries correctly', async() => {
        const testDomain = 'test1';
        const testDomainLabelHash = sha3(testDomain);
        const testDomainNameHash = sha3(ethNameHash, testDomainLabelHash);
        const testName = 'test1.eth.';
        const testNameHash = sha3(testName);

        await registrar.register(testDomainLabelHash, { from: testDomainOwner });

        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), false);

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 1, '0x012345', '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), true);

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 2, '0x012345', '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), true);

        await resolver.clearDnsRecord(testDomainNameHash, testNameHash, 2, '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), true);

        await resolver.clearDnsRecord(testDomainNameHash, testNameHash, 1, '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), false);
    });

    it('should not double-count node entries', async() => {
        const testDomain = 'test2';
        const testDomainLabelHash = sha3(testDomain);
        const testDomainNameHash = sha3(ethNameHash, testDomainLabelHash);
        const testName = 'test2.eth.';
        const testNameHash = sha3(testName);

        await registrar.register(testDomainLabelHash, { from: testDomainOwner });

        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), false);

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 1, '0x012345', '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), true);

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 1, '0x543210', '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), true);

        await resolver.clearDnsRecord(testDomainNameHash, testNameHash, 1, '', { from: testDomainOwner });
        assert.equal(await resolver.hasDnsRecords(testDomainNameHash, testNameHash), false);
    });

    it('should update SOA correctly', async() => {
        const testDomain = 'test3';
        const testDomainLabelHash = sha3(testDomain);
        const testDomainNameHash = sha3(ethNameHash, testDomainLabelHash);
        const testName = 'test3.eth.';
        const testNameHash = sha3(testName);

        await registrar.register(testDomainLabelHash, { from: testDomainOwner });

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 1, '0x111111', '0xffffff', { from: testDomainOwner });
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 1), '0x111111');
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 6), '0xffffff');

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 1, '0x222222', '', { from: testDomainOwner });
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 1), '0x222222');
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 6), '0xffffff');

        await resolver.setDnsRecord(testDomainNameHash, testNameHash, 1, '0x333333', '0xeeeeee', { from: testDomainOwner });
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 1), '0x333333');
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 6), '0xeeeeee');

        await resolver.setDnsRecord(testDomainNameHash, '', 6, '0xdddddd', '', { from: testDomainOwner });
        assert.equal(await resolver.dnsRecord(testDomainNameHash, testNameHash, 6), '0xdddddd');
    });

    it('cannot set SOA incorrectly', async() => {
        const testDomain = 'test4';
        const testDomainLabelHash = sha3(testDomain);
        const testDomainNameHash = sha3(ethNameHash, testDomainLabelHash);
        const testName = 'test4.eth.';
        const testNameHash = sha3(testName);

        await registrar.register(testDomainLabelHash, { from: testDomainOwner });

        try {
            // With double SOA data == invalid
            await resolver.setDnsRecord(testDomainNameHash, '', 6, '0x111111', '0x222222', { from: testDomainOwner });
            assert.fail();
        } catch (error) {
            assertRevert(error);
        }
    });

    it('cannot set RRSIG directly', async() => {
        const testDomain = 'test5';
        const testDomainLabelHash = sha3(testDomain);
        const testDomainNameHash = sha3(ethNameHash, testDomainLabelHash);
        const testName = 'test5.eth.';
        const testNameHash = sha3(testName);

        await registrar.register(testDomainLabelHash, { from: testDomainOwner });

        try {
            await resolver.setDnsRecord(testDomainNameHash, testNameHash, 46, '0x111111', '0xffffff', { from: testDomainOwner });
            assert.fail();
        } catch (error) {
            assertRevert(error);
        }
    });
});
