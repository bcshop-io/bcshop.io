pragma solidity ^0.4.24;

import "../common/Manageable.sol";
import "./IAffiliateStorage.sol";


/**@dev Stores the information about affiliate-vendor relations */
contract AffiliateStorage is IAffiliateStorage, Manageable {

    //
    // Events
    event AffiliateSet(address indexed vendor, address indexed affiliate);


    //
    // Storage data
    mapping(address=>address) public affiliates;    //vendor->affiliate mapping
    mapping(address=>bool) public affiliateSet;     //vendor-> true if has affiliate

    //
    // Methods

    constructor() public {
    }

    /**@dev sets affiliate for a given vendor*/
    function setAffiliate(address vendor, address affiliate) 
        public 
        managerOnly 
    {
        affiliates[vendor] = affiliate;
        affiliateSet[vendor] = true;
        emit AffiliateSet(vendor, affiliate);
    }
}