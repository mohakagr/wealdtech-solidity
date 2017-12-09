pragma solidity ^0.4.18;

import './PublicResolver.sol';


// Copyright © 2017 Weald Technology Trading Limited
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

contract EnsRegistry {
    function owner(bytes32 node) public constant returns(address);
}


/**
 * @title DnsResolver
 *        A DNS resolver that handles all common types of DNS resource record,
 *        plus the ability to expand to new types arbitrarily.
 *
 *        Definitions used within this contract are as follows:
 *          - node is the namehash of the ENS domain e.g. namehash('myzone.eth')
 *          - name is the sha3 of the fully-qualifid name of the node e.g. keccak256('www.myzone.eth.') (note the trailing period)
 *          - resource is the numeric ID of the record from https://en.wikipedia.org/wiki/List_of_DNS_record_types
 *          - data is DNS wire format data for the record
 *
 *        State of this contract: stable; development complete but the code is
 *        unaudited. and may contain bugs and/or security holes. Use at your own
 *        risk.
 *
 * @author Jim McDonald
 * @notice If you use this contract please consider donating some Ether or
 *         some of your ERC-20 token to wsl.wealdtech.eth to support continued
 *         development of these and future contracts
 */
contract DnsResolver is PublicResolver {

    // node => name => resource => data
    mapping(bytes32=>mapping(bytes32=>mapping(uint16=>bytes))) public records;

    // node => data
    mapping(bytes32=>bytes) public zones;

    // Count of number of entries for a given node
    mapping(bytes32=>uint16) public nodeEntriesCount;

    // Count of number of entries for a given name
    mapping(bytes32=>mapping(bytes32=>uint16)) public nameEntriesCount;

    // The ENS registry
    AbstractENS registry;

    // Getters
    function nodeEntries(bytes32 node) public view returns (uint16 entries) {
        return nodeEntriesCount[node];
    }

    function nameEntries(bytes32 node, bytes32 name) public view returns (uint16 entries) {
        return nameEntriesCount[node][name];
    }

    // Restrict operations to the owner of the relevant ENS node
    modifier onlyNodeOwner(bytes32 node) {
        require(msg.sender == registry.owner(node));
        _;
    }

    function DnsResolver(AbstractENS _registry) public PublicResolver(_registry) {
        registry = _registry;
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0xd7c2836a || interfaceId == 0x7ce1c1bd || super.supportsInterface(interfaceId);
    }
    
    function dnsRecord(bytes32 node, bytes32 name, uint16 resource) public view returns (bytes data) {
        return records[node][name][resource];
    }

    function setDnsRecord(bytes32 node, bytes32 name, uint16 resource, bytes data) public onlyNodeOwner(node) {
        if (records[node][name][resource].length == 0) {
            nodeEntriesCount[node] += 1;
            nameEntriesCount[node][name] += 1;
        }
        records[node][name][resource] = data;
    }

    function clearDnsRecord(bytes32 node, bytes32 name, uint16 resource) public onlyNodeOwner(node) {
        if (records[node][name][resource].length != 0) {
            nodeEntriesCount[node] -= 1;
            nameEntriesCount[node][name] -= 1;
            delete(records[node][name][resource]);
        }
    }

    function dnsZone(bytes32 node) public view returns (bytes data) {
        return zones[node];
    }

    function setDnsZone(bytes32 node, bytes data) public onlyNodeOwner(node) {
        zones[node] = data;
    }

    function clearDnsZone(bytes32 node) public onlyNodeOwner(node) {
        delete(zones[node]);
    }
}