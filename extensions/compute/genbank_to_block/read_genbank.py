import requests
import json
from Bio import SeqIO
import sys

input_file = sys.argv[1]
data_file = sys.argv[2]
block_file = sys.argv[3]
seq_file = sys.argv[4]

def genbank2Json(fname):
	#data = { name:"",
	#		features : [
	#			{start:3,end:48,strand:"-",row:0,color:"#FFaaaa",text:"Test06",textColor:"black",isORF:true}
	#			],
	#		enzymes : [],
	#		seq : "
	#		}

	# data is the python dict object will be converted to json
	data = {}

	# gbk is a customized file format which can store more information than standard genbank, e.g. feture color
	if fname.split(".")[-1]=="gbk":
		gbkMode = True
	else:
		gbkMode = False

	gb = SeqIO.parse(open(fname,'rU'),"genbank").next()
	data["seq"] = str(gb.seq)
	data["features"] = []
	for f in gb.features:
		if f.type == 'source':
			continue
		title = f.type
		color = "white"
		if gbkMode and f.type=="misc_feature":
			strand = "."
		else:
			strand = strandSign(f.location.strand)
		q = f.qualifiers
		if q.has_key('note'):
			title = q['note'][0]	#set feature name by first not if there is
			if gbkMode:
				for i in range(1,len(q['note'])):
					note = q['note'][i]
					for n in note.split(";"):
						sp = n.split(":")
						if sp[0].strip() == 'color':
							color = sp[1]
						elif sp[0].strip() == 'direction':
							strand = strandSignGbk(sp[1].strip())

		feature = {"start":f.location.start.position, "end":f.location.end.position, "strand":strand, "row":0, "color":color, "text":title, "textColor":"black", "isORF":False}
		data["features"].append(feature)
		data["name"]=fname.split("/")[-1].split(".")[0]

	return data

#convert genbank
data = genbank2Json(input_file)

#create block
block = {
      "metadata": {
        "authors": [],
        "version": "0.0.0",
        "tags": {}  },
      "options":[],
      "components":[],
      "rules": [],
      "notes": {},
      "sequence": { 
        "url": None,
				"annotations" : data["features"]
			}   
    }

#write output files
fh = open(seq_file,"w")
fh.write(data["sequence"])  #sequence
fh.close()

json.dump( data, open(data_file,"w") )  #data
json.dump( block, open(block_file,"w") )   #block - server will fix sequence URL

