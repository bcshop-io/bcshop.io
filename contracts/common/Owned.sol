pragma solidity ^0.4.10;


contract Owned {
    address public owner;    

    event OwnerUpdate(address _prevOwner, address _newOwner);

    function Owned() {
        owner = msg.sender;
    }

    // allows execution by the owner only
    modifier ownerOnly {
        assert(msg.sender == owner);
        _;
    }

    /**@dev allows transferring the contract ownership. The new owner must accept the transfer */
    function transferOwnership(address _newOwner) public ownerOnly {
        require(_newOwner != owner);
        owner = _newOwner;
    }
}
