pragma solidity ^0.4.10;

contract PartnerSaleStub {
    function transferToPartner();
}

//a malicious crowdsale partner that could potentially call multiple times the transferToPartner function
contract ErrorPartner {
    
    bool hit;
    function ErrorPartner() {
        hit = false;
    }

    function() payable {
        PartnerSaleStub s = PartnerSaleStub(msg.sender);
        
        if(address(s) != 0x0 && !hit) {
            hit = true;
            s.transferToPartner();
        }
    }
}

//a contract that rejects any ether transfers to it
contract EtherReject {
    function EtherReject() {}
    function() payable {require(false);}
}