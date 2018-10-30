pragma solidity ^0.4.24;

contract ICheckList {
    function contains(address addr) public view returns(bool) {return false;}
    function set(address addr, bool state) public;
}