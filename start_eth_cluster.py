#!/usr/bin/python3
import os, sys
import time
import argparse
import subprocess as proc
import libtmux
import re

parser = argparse.ArgumentParser(description='Launch Ethereum test nodes in screen')
parser.add_argument('--geth', '-e', default='geth', help='geth executable')
parser.add_argument('--start-port', '-p', type=int, default=4230, help='inital port')
parser.add_argument('--nodes', '-n', type=int, default=8, help='number of nodes')
parser.add_argument('--netid', '-id', type=int, default=4226, help='Ethereum network ID')
parser.add_argument('--datadir', '-d', help='Data directory')
parser.add_argument('--genesis', '-g', help='Genesis file', default='genesis.json')
args = parser.parse_args()

data_dir = args.datadir
if not data_dir:
    data_dir = os.path.expanduser("~/eth_net_{}/".format(args.netid))
print("Using directory", data_dir)

passwd = data_dir+'password'
try:
    os.makedirs(data_dir)
    with open(passwd,'w') as f:
        f.write('toto')
except Exception as e:
    pass

print("Creating {} nodes.".format(args.nodes))
for x in range(0, args.nodes):
    ddir = data_dir + "node{}".format(x)
    try:
        os.makedirs(ddir)
        cmd = '{} --datadir {} --networkid "{}" --identity "Node{}"  init {}'.format(args.geth, ddir, args.netid, x, args.genesis)
        print(cmd)
        proc.run(cmd, shell=True)
        cmd = '{} --datadir {} --networkid "{}" --identity "Node{}" --password {} account new'.format(args.geth, ddir, args.netid, x, passwd)
        print(cmd)
        proc.run(cmd, shell=True)
    except Exception as e:
        print(e)

enode_finder = re.compile(b"enode://[0-9a-zA-Z]+@.+:\d+")
enodes = []
try:
    for x in range(0, args.nodes):
        ddir = data_dir + "node{}".format(x)
        cmd = '{} --datadir {} --networkid "{}" --identity "Node{}" --port {} console'.format(args.geth, ddir, args.netid, x, args.start_port+x)
        print(cmd)
        with proc.Popen(cmd, shell=True, stdout=proc.PIPE, stderr=proc.PIPE) as p:
            while True:
                l = p.stderr.readline()
                if l != '':
                    res = enode_finder.search(l);
                    if res:
                        enodes.append(res.group(0))
                        break
                else:
                    break
except Exception as e:
    print(e)


for enode in enodes:
    print(enode)

bootnodes = b",".join(enodes).decode().replace('[::]', '[::1]')

ts = libtmux.Server()

screen_name = "eth{}".format(args.start_port)
print("Launching {} nodes in tmux session {}.".format(args.nodes, screen_name))
s = ts.new_session(screen_name)

for x in range(0, args.nodes):
    nm = "node{}".format(x)
    w = s.new_window(nm)
    p = w.attached_pane
    ddir = data_dir + nm
    suppargs = ''
    #if x >= args.nodes/2:
    #    suppargs += '--minerthreads "1" --mine '
    if x == 0:
        suppargs += '--rpc --rpcapi "personal,eth,net,web3" '
    cmd = '{} --datadir {} -networkid "{}" --identity "{}" --port {} --bootnodes "{}" {} --verbosity "3" console'.format(args.geth, ddir, args.netid, nm, args.start_port+x, bootnodes, suppargs)
    print(cmd)
    p.send_keys(cmd)
    time.sleep(1)
