pragma solidity ^0.4.10;

import "truffle/Assert.sol";
import "truffle/DeployedAddresses.sol";

import "../contracts/helpers/AddressStorage.sol";

//required migrations
//3_helper_deploy.js
contract AddressStorageUser {

    address address1;
    address address2;
    address address3;
    address address4;
    
    function AddressStorageUser() {
        AddressStorage asr = (AddressStorage)(DeployedAddresses.AddressStorage());
        address1 = asr.address1();
        address2 = asr.address2();
        address3 = asr.address3();
        address4 = asr.address4();   
    }
    
}