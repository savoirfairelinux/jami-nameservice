pragma solidity ^0.5.2;
/*
 * Copyright (c) 2014 Gav Wood <g@ethdev.com>
 * Copyright (c) 2016 Savoir-faire Linux Inc.
 *
 * Author: Gav Wood <g@ethdev.com>
 * Author: Adrien Béraud <adrien.beraud@savoirfairelinux.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * urnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

contract NameRegister {
  function addr(bytes32 _name) public view returns (address o_owner) {}
  function name(address _owner) public view returns (bytes32 o_name) {}
}

contract Registrar is NameRegister {
  event Changed(bytes32 indexed name);
  event PrimaryChanged(bytes32 indexed name, address indexed addr, address owner);

  function owner(bytes32 _name) public view returns (address o_owner) {}
  function addr(bytes32 _name) public view returns (address o_address) {}
  function subRegistrar(bytes32 _name) public view returns (address o_subRegistrar) {}
  function content(bytes32 _name) public view returns (bytes32 o_content) {}

  function name(address _owner) public view returns (bytes32 o_name) {}
}

contract GlobalRegistrar is Registrar {
  struct Record {
    string publicKey;
    string signedName;
    address owner;
    address primary;
    address subRegistrar;
    bytes32 content;
    uint value;
    uint renewalDate;
  }

  function reserve(bytes32 _name, address _a) public {
    if (m_toRecord[_name].owner == address(0) && m_toName[_a] == 0) {
      m_toRecord[_name].owner = msg.sender;
      m_toRecord[_name].primary = _a;
      m_toName[_a] = _name;
      emit Changed(_name);
      emit PrimaryChanged(_name, _a, msg.sender);
    }
  }
  function reserveFor(bytes32 _name, address _owner, address _a, string memory _publickey, string memory _signedname) public {
    if (m_toRecord[_name].owner == address(0) && m_toName[_a] == 0) {
      m_toRecord[_name].owner = _owner;
      m_toRecord[_name].primary = _a;
      m_toRecord[_name].publicKey = _publickey;
      m_toRecord[_name].signedName = _signedname;

      m_toName[_a] = _name;
      emit Changed(_name);
      emit PrimaryChanged(_name, _a, _owner);
    }
  }

  modifier onlyrecordowner(bytes32 _name) { if (m_toRecord[_name].owner == msg.sender) _; }

  function transfer(bytes32 _name, address _newOwner) public onlyrecordowner(_name) {
    m_toRecord[_name].owner = _newOwner;
    emit Changed(_name);
  }

  function disown(bytes32 _name) public onlyrecordowner(_name) {
    if (m_toName[m_toRecord[_name].primary] == _name)
    {
      emit PrimaryChanged(_name, m_toRecord[_name].primary, m_toRecord[_name].owner);
      m_toName[m_toRecord[_name].primary] = "";
    }
    delete m_toRecord[_name];
    emit Changed(_name);
  }

  function setAddress(bytes32 _name, address _a, bool _primary) public onlyrecordowner(_name) {
    m_toRecord[_name].primary = _a;
    if (_primary)
    {
      emit PrimaryChanged(_name, _a, m_toRecord[_name].owner);
      m_toName[_a] = _name;
    }
    emit Changed(_name);
  }
  function setSubRegistrar(bytes32 _name, address _registrar) public onlyrecordowner(_name) {
    m_toRecord[_name].subRegistrar = _registrar;
    emit Changed(_name);
  }
  function setContent(bytes32 _name, bytes32 _content) public onlyrecordowner(_name) {
    m_toRecord[_name].content = _content;
    emit Changed(_name);
  }

  function owner(bytes32 _name) public view returns (address) { return m_toRecord[_name].owner; }
  function addr(bytes32 _name) public view returns (address) { return m_toRecord[_name].primary; }
  function register(bytes32 _name) public view returns (address) { return m_toRecord[_name].subRegistrar; }
  function content(bytes32 _name) public view returns (bytes32) { return m_toRecord[_name].content; }
  function name(address _a) public view returns (bytes32 o_name) { return m_toName[_a]; }
  function publickey(bytes32 _name) public view returns (string memory) { return m_toRecord[_name].publicKey; }
  function signature(bytes32 _name) public view returns (string memory) { return m_toRecord[_name].signedName; }

  mapping (address => bytes32) m_toName;
  mapping (bytes32 => Record) m_toRecord;
}
