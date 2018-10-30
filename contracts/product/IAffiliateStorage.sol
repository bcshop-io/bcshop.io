pragma solidity ^0.4.24;


contract IAffiliateStorage { 
    function affiliates(address) public view returns (address) {}
    function affiliateSet(address) public view returns (bool) {}
    function setAffiliate(address, address) public;
}
