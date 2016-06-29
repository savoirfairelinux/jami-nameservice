contract NameRegister {
  function addr(bytes32 _name) constant returns (address o_owner) {}
  function name(address _owner) constant returns (bytes32 o_name) {}
}

contract Registrar is NameRegister {
  event Changed(bytes32 indexed name);
  event PrimaryChanged(bytes32 indexed name, address indexed addr, address owner);

  function owner(bytes32 _name) constant returns (address o_owner) {}
  function addr(bytes32 _name) constant returns (address o_address) {}
  function subRegistrar(bytes32 _name) constant returns (address o_subRegistrar) {}
  function content(bytes32 _name) constant returns (bytes32 o_content) {}

  function name(address _owner) constant returns (bytes32 o_name) {}
}

contract GlobalRegistrar is Registrar {
  struct Record {
    address owner;
    address primary;
    address subRegistrar;
    bytes32 content;
    uint value;
    uint renewalDate;
  }

  function Registrar() {
  }

  function reserve(bytes32 _name) {
    if (m_toRecord[_name].owner == 0) {
      m_toRecord[_name].owner = msg.sender;
      Changed(_name);
    }
  }
  function reserveFor(bytes32 _name, address _owner, address _a) {
    if (m_toRecord[_name].owner == 0) {
      m_toRecord[_name].owner = _owner;
      m_toRecord[_name].primary = _a;
      m_toName[_a] = _name;
      Changed(_name);
      PrimaryChanged(_name, _a, _owner);
    }
  }

  modifier onlyrecordowner(bytes32 _name) { if (m_toRecord[_name].owner == msg.sender) _ }

  function transfer(bytes32 _name, address _newOwner) onlyrecordowner(_name) {
    m_toRecord[_name].owner = _newOwner;
    Changed(_name);
  }

  function disown(bytes32 _name) onlyrecordowner(_name) {
    if (m_toName[m_toRecord[_name].primary] == _name)
    {
      PrimaryChanged(_name, m_toRecord[_name].primary, m_toRecord[_name].owner);
      m_toName[m_toRecord[_name].primary] = "";
    }
    delete m_toRecord[_name];
    Changed(_name);
  }

  function setAddress(bytes32 _name, address _a, bool _primary) onlyrecordowner(_name) {
    m_toRecord[_name].primary = _a;
    if (_primary)
    {
      PrimaryChanged(_name, _a, m_toRecord[_name].owner);
      m_toName[_a] = _name;
    }
    Changed(_name);
  }
  function setSubRegistrar(bytes32 _name, address _registrar) onlyrecordowner(_name) {
    m_toRecord[_name].subRegistrar = _registrar;
    Changed(_name);
  }
  function setContent(bytes32 _name, bytes32 _content) onlyrecordowner(_name) {
    m_toRecord[_name].content = _content;
    Changed(_name);
  }

  function owner(bytes32 _name) constant returns (address) { return m_toRecord[_name].owner; }
  function addr(bytes32 _name) constant returns (address) { return m_toRecord[_name].primary; }
  function register(bytes32 _name) constant returns (address) { return m_toRecord[_name].subRegistrar; }
  function content(bytes32 _name) constant returns (bytes32) { return m_toRecord[_name].content; }
  function name(address _a) constant returns (bytes32 o_name) { return m_toName[_a]; }

  mapping (address => bytes32) m_toName;
  mapping (bytes32 => Record) m_toRecord;
}
